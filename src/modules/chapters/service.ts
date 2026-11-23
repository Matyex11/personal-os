import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { AppError, toUserMessage } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import type { ChapterRow } from "@/lib/db/types";
import { createChapterSchema } from "@/modules/chapters/schemas";
import {
  canActivateChapter,
  canCloseChapter,
  canMakeChapterCurrent,
  classifyMakeCurrentResult,
  shouldRestorePreviousCurrent,
  type ChapterLifecycleView,
} from "@/modules/chapters/lifecycle";
import { isoDateSchema, uuidSchema } from "@/lib/validation/common";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

function toLifecycleView(row: ChapterRow): ChapterLifecycleView {
  return {
    id: row.id,
    status: row.status,
    started_on: row.started_on,
    ended_on: row.ended_on,
    is_current: row.is_current,
  };
}

function zodOrAppMessage(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? "Invalid chapter input.";
  }
  return toUserMessage(error);
}

async function loadOwnedChapter(
  supabase: SupabaseServer,
  userId: string,
  chapterId: string,
): Promise<ChapterRow | null> {
  const { data, error } = await supabase
    .from("chapters")
    .select("*")
    .eq("id", chapterId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new AppError("unavailable", "Could not load chapter.");
  return (data as ChapterRow | null) ?? null;
}

export type RestorePreviousCurrentResult =
  | { ok: true; restored: boolean; reason?: "already_current" | "concurrent_current" | "not_active" }
  | { ok: false; message: string };

/**
 * Restore previous current only when:
 * - owned by userId
 * - still active
 * - not already current
 * - no other chapter is current for the user
 * Never overwrites a concurrent make-current success.
 */
async function restorePreviousCurrentIfSafe(
  supabase: SupabaseServer,
  userId: string,
  previousCurrentId: string,
): Promise<RestorePreviousCurrentResult> {
  const { data: existing, error: probeError } = await supabase
    .from("chapters")
    .select("id")
    .eq("user_id", userId)
    .eq("is_current", true)
    .maybeSingle();
  if (probeError) {
    return {
      ok: false,
      message: "Could not verify current chapter while restoring.",
    };
  }
  if (existing) {
    if ((existing.id as string) === previousCurrentId) {
      return { ok: true, restored: false, reason: "already_current" };
    }
    return { ok: true, restored: false, reason: "concurrent_current" };
  }

  const { data: previous, error: loadError } = await supabase
    .from("chapters")
    .select("id, status, is_current")
    .eq("id", previousCurrentId)
    .eq("user_id", userId)
    .maybeSingle();
  if (loadError) {
    return {
      ok: false,
      message: "Could not load the previous chapter for restore.",
    };
  }
  if (!previous) {
    return {
      ok: false,
      message: "Previous current chapter is no longer available to restore.",
    };
  }
  if (previous.status !== "active") {
    return { ok: true, restored: false, reason: "not_active" };
  }
  if (previous.is_current) {
    return { ok: true, restored: false, reason: "already_current" };
  }

  const { data: restored, error } = await supabase
    .from("chapters")
    .update({ is_current: true })
    .eq("id", previousCurrentId)
    .eq("user_id", userId)
    .eq("status", "active")
    .eq("is_current", false)
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return { ok: true, restored: false, reason: "concurrent_current" };
    }
    return {
      ok: false,
      message: "Could not restore the previous current chapter.",
    };
  }
  if (!restored) {
    return {
      ok: false,
      message: "Could not restore the previous current chapter.",
    };
  }
  return { ok: true, restored: true };
}

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
    let parsed: z.infer<typeof createChapterSchema>;
    try {
      parsed = createChapterSchema.parse(input);
    } catch (error) {
      throw new AppError("validation", zodOrAppMessage(error));
    }
    const supabase = await createClient();

    // Schema already forbids planned+isCurrent; keep insert flag honest.
    const createAsCurrent = parsed.isCurrent === true && parsed.status === "active";
    let previousCurrentId: string | null = null;

    if (createAsCurrent) {
      const { data: previous, error: snapshotError } = await supabase
        .from("chapters")
        .select("id, status, is_current")
        .eq("user_id", user.id)
        .eq("is_current", true)
        .maybeSingle();
      if (snapshotError) {
        throw new AppError("unavailable", "Could not read the current chapter.");
      }

      if (previous) {
        if (previous.status !== "active") {
          throw new AppError(
            "conflict",
            "Current chapter is not active; cannot replace it safely.",
          );
        }
        previousCurrentId = previous.id as string;

        const { data: cleared, error: unsetError } = await supabase
          .from("chapters")
          .update({ is_current: false })
          .eq("id", previousCurrentId)
          .eq("user_id", user.id)
          .eq("is_current", true)
          .select("id")
          .maybeSingle();
        if (unsetError) {
          throw new AppError(
            "unavailable",
            "Could not clear the previous current chapter.",
          );
        }
        if (!cleared) {
          throw new AppError(
            "conflict",
            "Current chapter changed before create. Try again.",
          );
        }
      }
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
        is_current: createAsCurrent,
      })
      .select("*")
      .single();

    if (error) {
      const baseMessage =
        error.code === "23505"
          ? "Could not create chapter as current because another chapter is already current."
          : "Could not create chapter.";

      if (previousCurrentId) {
        const restore = await restorePreviousCurrentIfSafe(
          supabase,
          user.id,
          previousCurrentId,
        );
        if (!restore.ok) {
          throw new AppError(
            "unavailable",
            `${baseMessage} ${restore.message} Create failed and the previous current chapter may not have been restored.`,
          );
        }
        if (!restore.restored) {
          const { data: who, error: whoError } = await supabase
            .from("chapters")
            .select("id")
            .eq("user_id", user.id)
            .eq("is_current", true)
            .maybeSingle();
          if (whoError || !who) {
            throw new AppError(
              error.code === "23505" ? "conflict" : "unavailable",
              `${baseMessage} The previous current chapter could not be restored.`,
            );
          }
          // Concurrent chapter is current — do not overwrite; create still failed.
        }
      }

      throw new AppError(
        error.code === "23505" ? "conflict" : "unavailable",
        baseMessage,
      );
    }
    return { ok: true as const, data: data as ChapterRow };
  } catch (error) {
    return { ok: false as const, message: toUserMessage(error) };
  }
}

const chapterIdSchema = z.object({
  chapterId: uuidSchema,
});

/** P0.3.1 — planned → active; stays not current. */
export async function activateChapter(input: unknown) {
  try {
    const user = await requireUser();
    let parsed: z.infer<typeof chapterIdSchema>;
    try {
      parsed = chapterIdSchema.parse(input);
    } catch (error) {
      throw new AppError("validation", zodOrAppMessage(error));
    }
    const supabase = await createClient();
    const chapter = await loadOwnedChapter(supabase, user.id, parsed.chapterId);
    const check = canActivateChapter(chapter ? toLifecycleView(chapter) : null);
    if (!check.ok) throw new AppError(check.code, check.message);

    const { data, error } = await supabase
      .from("chapters")
      .update({ status: "active" })
      .eq("id", parsed.chapterId)
      .eq("user_id", user.id)
      .eq("status", "planned")
      .select("*")
      .maybeSingle();

    if (error) throw new AppError("unavailable", "Could not activate chapter.");
    if (!data) {
      throw new AppError("conflict", "Chapter is no longer planned.");
    }
    return { ok: true as const, data: data as ChapterRow };
  } catch (error) {
    return { ok: false as const, message: toUserMessage(error) };
  }
}

/**
 * P0.3.2 — Make an active chapter current.
 *
 * Sequence (no RPC / no migration): load → no-op if already current →
 * snapshot previous current → unset all current → set target.
 * On unique violation (23505): do not report success unless target is current;
 * restore previous only when no other current exists.
 *
 * Atomicity limitation: unset+set is two statements. Concurrent clients can
 * interleave; the partial unique index `chapters_one_current_per_user` is the
 * final guard. This function never claims success when the target is not current.
 */
export async function makeChapterCurrent(input: unknown) {
  try {
    const user = await requireUser();
    let parsed: z.infer<typeof chapterIdSchema>;
    try {
      parsed = chapterIdSchema.parse(input);
    } catch (error) {
      throw new AppError("validation", zodOrAppMessage(error));
    }
    const supabase = await createClient();
    const chapter = await loadOwnedChapter(supabase, user.id, parsed.chapterId);
    const check = canMakeChapterCurrent(chapter ? toLifecycleView(chapter) : null);
    if (!check.ok) throw new AppError(check.code, check.message);

    if (chapter!.is_current) {
      return { ok: true as const, data: chapter! };
    }

    const { data: previousCurrent, error: previousError } = await supabase
      .from("chapters")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_current", true)
      .maybeSingle();
    if (previousError) {
      throw new AppError("unavailable", "Could not read the current chapter.");
    }
    const previousCurrentId = (previousCurrent?.id as string | undefined) ?? null;

    if (previousCurrentId) {
      const { error: unsetError } = await supabase
        .from("chapters")
        .update({ is_current: false })
        .eq("user_id", user.id)
        .eq("is_current", true);
      if (unsetError) {
        throw new AppError("unavailable", "Could not clear the previous current chapter.");
      }
    }

    const { data: updated, error: setError } = await supabase
      .from("chapters")
      .update({ is_current: true })
      .eq("id", parsed.chapterId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .select("*")
      .maybeSingle();

    const uniqueViolation = Boolean(setError && setError.code === "23505");

    if (setError && !uniqueViolation) {
      const { data: afterFail } = await supabase
        .from("chapters")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_current", true)
        .maybeSingle();
      if (
        shouldRestorePreviousCurrent({
          previousCurrentId,
          currentAfterFailureId: (afterFail?.id as string | undefined) ?? null,
          targetChapterId: parsed.chapterId,
        })
      ) {
        await restorePreviousCurrentIfSafe(supabase, user.id, previousCurrentId!);
      }
      throw new AppError("unavailable", "Could not make chapter current.");
    }

    const { data: currentAfter, error: currentAfterError } = await supabase
      .from("chapters")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_current", true)
      .maybeSingle();
    if (currentAfterError) {
      throw new AppError("unavailable", "Could not verify current chapter.");
    }

    const outcome = classifyMakeCurrentResult({
      targetChapterId: parsed.chapterId,
      updatedRow: updated ? toLifecycleView(updated as ChapterRow) : null,
      currentAfterAttemptId: (currentAfter?.id as string | undefined) ?? null,
      uniqueViolation,
    });

    if (outcome.kind === "success" || outcome.kind === "already_current") {
      const row =
        updated && (updated as ChapterRow).id === parsed.chapterId
          ? (updated as ChapterRow)
          : await loadOwnedChapter(supabase, user.id, parsed.chapterId);
      if (!row?.is_current) {
        throw new AppError("conflict", "Could not make this chapter current.");
      }
      return { ok: true as const, data: row };
    }

    if (
      shouldRestorePreviousCurrent({
        previousCurrentId,
        currentAfterFailureId: (currentAfter?.id as string | undefined) ?? null,
        targetChapterId: parsed.chapterId,
      })
    ) {
      await restorePreviousCurrentIfSafe(supabase, user.id, previousCurrentId!);
    }

    throw new AppError("conflict", outcome.message);
  } catch (error) {
    return { ok: false as const, message: toUserMessage(error) };
  }
}

const closeSchema = z.object({
  chapterId: uuidSchema,
  endedOn: isoDateSchema,
});

/** P0.3.3 — Close an active chapter; preserves title/summary/started_on. */
export async function closeChapter(input: unknown) {
  try {
    const user = await requireUser();
    let parsed: z.infer<typeof closeSchema>;
    try {
      parsed = closeSchema.parse(input);
    } catch (error) {
      throw new AppError("validation", zodOrAppMessage(error));
    }
    const supabase = await createClient();
    const chapter = await loadOwnedChapter(supabase, user.id, parsed.chapterId);
    const check = canCloseChapter(
      chapter ? toLifecycleView(chapter) : null,
      parsed.endedOn,
    );
    if (!check.ok) throw new AppError(check.code, check.message);

    const { data, error } = await supabase
      .from("chapters")
      .update({
        status: "closed",
        ended_on: parsed.endedOn,
        is_current: false,
      })
      .eq("id", parsed.chapterId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .select("*")
      .maybeSingle();

    if (error) throw new AppError("unavailable", "Could not close chapter.");
    if (!data) {
      throw new AppError("conflict", "Chapter is no longer active.");
    }
    return { ok: true as const, data: data as ChapterRow };
  } catch (error) {
    return { ok: false as const, message: toUserMessage(error) };
  }
}
