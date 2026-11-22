import { requireUser } from "@/lib/auth/require-user";
import { AppError, toUserMessage } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import type { ChapterRow } from "@/lib/db/types";
import { createChapterSchema } from "@/modules/chapters/schemas";
import { isoDateSchema } from "@/lib/validation/common";
import { z } from "zod";

export async function listChapters(): Promise<
  { ok: true; data: ChapterRow[] } | { ok: false; message: string }
> {
  try {
    const user = await requireUser();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("chapters")
      .select("*")
      .eq("user_id", user.id)
      .order("started_on", { ascending: false });

    if (error) throw new AppError("unavailable", "Could not load chapters.");
    return { ok: true, data: (data ?? []) as ChapterRow[] };
  } catch (error) {
    return { ok: false, message: toUserMessage(error) };
  }
}

export async function createChapter(input: unknown) {
  try {
    const user = await requireUser();
    const parsed = createChapterSchema.parse(input);
    const supabase = await createClient();

    if (parsed.isCurrent) {
      await supabase
        .from("chapters")
        .update({ is_current: false })
        .eq("user_id", user.id)
        .eq("is_current", true);
    }

    const { data, error } = await supabase
      .from("chapters")
      .insert({
        user_id: user.id,
        title: parsed.title,
        summary: parsed.summary ?? null,
        status: parsed.status,
        started_on: parsed.startedOn,
        ended_on: parsed.endedOn ?? null,
        is_current: parsed.isCurrent,
      })
      .select("*")
      .single();

    if (error) throw new AppError("unavailable", "Could not create chapter.");
    return { ok: true as const, data: data as ChapterRow };
  } catch (error) {
    return { ok: false as const, message: toUserMessage(error) };
  }
}

const closeSchema = z.object({
  chapterId: z.string().uuid(),
  endedOn: isoDateSchema,
});

export async function closeChapter(input: unknown) {
  try {
    const user = await requireUser();
    const parsed = closeSchema.parse(input);
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("chapters")
      .update({
        status: "closed",
        ended_on: parsed.endedOn,
        is_current: false,
      })
      .eq("id", parsed.chapterId)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (error) throw new AppError("unavailable", "Could not close chapter.");
    return { ok: true as const, data: data as ChapterRow };
  } catch (error) {
    return { ok: false as const, message: toUserMessage(error) };
  }
}
