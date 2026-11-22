import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { AppError, toUserMessage } from "@/lib/errors";
import type { ModuleActivationRow } from "@/lib/db/types";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/common";

const MODULE_KEYS = [
  "habits",
  "tasks",
  "projects",
  "milestones",
  "checkins",
  "finances",
  "physical",
  "behavioural",
  "reviews",
  "xnine_tracking",
] as const;

const moduleKeySchema = z.enum(MODULE_KEYS);

const upsertSchema = z.object({
  moduleKey: moduleKeySchema,
  isActive: z.boolean(),
  scope: z.enum(["global", "chapter"]).default("global"),
  chapterId: uuidSchema.optional(),
});

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
    const resolved = MODULE_KEYS.map((key) => {
      const chapterOverride = chapterId
        ? rows.find((row) => row.scope === "chapter" && row.chapter_id === chapterId && row.module_key === key)
        : undefined;
      const global = rows.find((row) => row.scope === "global" && row.module_key === key);
      const chosen = chapterOverride ?? global;
      return {
        moduleKey: key,
        isActive: chosen?.is_active ?? false,
        source: chosen?.scope ?? ("default_off" as const),
      };
    });

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
