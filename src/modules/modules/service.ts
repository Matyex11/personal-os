import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { AppError, toUserMessage } from "@/lib/errors";
import type { ModuleActivationRow } from "@/lib/db/types";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/common";
import { MODULE_KEYS, resolveModuleActivations } from "@/modules/modules/resolve";

const moduleKeySchema = z.enum(MODULE_KEYS);

const upsertSchema = z.object({
  moduleKey: moduleKeySchema,
  isActive: z.boolean(),
  scope: z.enum(["global", "chapter"]).default("global"),
  chapterId: uuidSchema.optional(),
});

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

async function assertOwnedChapter(
  supabase: SupabaseServer,
  userId: string,
  chapterId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("chapters")
    .select("id")
    .eq("id", chapterId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new AppError("unavailable", "Could not verify chapter.");
  if (!data) throw new AppError("not_found", "Chapter not found.");
}

export async function listModuleActivations(chapterId?: string) {
  try {
    const user = await requireUser();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("module_activations")
      .select("*")
      .eq("user_id", user.id);
    if (error) throw new AppError("unavailable", "Could not load modules.");

    const rows = (data ?? []) as ModuleActivationRow[];
    const resolved = resolveModuleActivations(rows, chapterId);

    return { ok: true as const, data: resolved, rows };
  } catch (error) {
    return { ok: false as const, message: toUserMessage(error) };
  }
}

export async function upsertModuleActivation(input: unknown) {
  try {
    const user = await requireUser();
    const parsed = upsertSchema.parse(input);
    if (parsed.scope === "chapter" && !parsed.chapterId) {
      throw new AppError("validation", "Chapter scope requires chapterId.");
    }

    const supabase = await createClient();

    if (parsed.scope === "chapter" && parsed.chapterId) {
      await assertOwnedChapter(supabase, user.id, parsed.chapterId);
    }

    const payload = {
      user_id: user.id,
      scope: parsed.scope,
      chapter_id: parsed.scope === "chapter" ? parsed.chapterId! : null,
      module_key: parsed.moduleKey,
      is_active: parsed.isActive,
      settings: {},
    };

    const { data, error } = await supabase
      .from("module_activations")
      .upsert(payload, {
        onConflict:
          parsed.scope === "global" ? "user_id,module_key" : "user_id,chapter_id,module_key",
      })
      .select("*")
      .single();

    // Partial unique indexes may not map cleanly to onConflict — fall back to manual.
    if (error) {
      const existingQuery = supabase
        .from("module_activations")
        .select("id")
        .eq("user_id", user.id)
        .eq("module_key", parsed.moduleKey)
        .eq("scope", parsed.scope);
      const existing =
        parsed.scope === "chapter"
          ? await existingQuery.eq("chapter_id", parsed.chapterId!).maybeSingle()
          : await existingQuery.is("chapter_id", null).maybeSingle();

      if (existing.error) {
        throw new AppError("unavailable", "Could not save module.");
      }

      if (existing.data?.id) {
        const updated = await supabase
          .from("module_activations")
          .update({ is_active: parsed.isActive })
          .eq("id", existing.data.id)
          .eq("user_id", user.id)
          .select("*")
          .single();
        if (updated.error) throw new AppError("unavailable", "Could not update module.");
        return { ok: true as const, data: updated.data as ModuleActivationRow };
      }

      const inserted = await supabase.from("module_activations").insert(payload).select("*").single();
      if (inserted.error) throw new AppError("unavailable", "Could not save module.");
      return { ok: true as const, data: inserted.data as ModuleActivationRow };
    }

    return { ok: true as const, data: data as ModuleActivationRow };
  } catch (error) {
    return { ok: false as const, message: toUserMessage(error) };
  }
}
