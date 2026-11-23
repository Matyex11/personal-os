import type { ChapterStatus } from "@/types/domain";
import { isoDateSchema } from "@/lib/validation/common";

export type ChapterLifecycleView = {
  id: string;
  status: ChapterStatus;
  started_on: string;
  ended_on: string | null;
  is_current: boolean;
};

export type LifecycleCheck =
  | { ok: true }
  | { ok: false; code: "validation" | "conflict" | "not_found"; message: string };

/** planned → active (never becomes current as a side effect). */
export function canActivateChapter(chapter: ChapterLifecycleView | null): LifecycleCheck {
  if (!chapter) {
    return { ok: false, code: "not_found", message: "Chapter not found." };
  }
  if (chapter.status === "closed") {
    return {
      ok: false,
      code: "conflict",
      message: "Closed chapters cannot be reactivated.",
    };
  }
  if (chapter.status !== "planned") {
    return {
      ok: false,
      code: "conflict",
      message: "Only planned chapters can be activated.",
    };
  }
  return { ok: true };
}

/** Only active chapters may be current. Already-current is a safe no-op. */
export function canMakeChapterCurrent(chapter: ChapterLifecycleView | null): LifecycleCheck {
  if (!chapter) {
    return { ok: false, code: "not_found", message: "Chapter not found." };
  }
  if (chapter.is_current) {
    return { ok: true };
  }
  if (chapter.status === "planned") {
    return {
      ok: false,
      code: "conflict",
      message: "Planned chapters cannot be made current. Activate first.",
    };
  }
  if (chapter.status === "closed") {
    return {
      ok: false,
      code: "conflict",
      message: "Closed chapters cannot be made current.",
    };
  }
  if (chapter.status !== "active") {
    return {
      ok: false,
      code: "conflict",
      message: "Only active chapters can be made current.",
    };
  }
  return { ok: true };
}

/** Only active chapters may close; end date must be a real calendar day ≥ start. */
export function canCloseChapter(
  chapter: ChapterLifecycleView | null,
  endedOn: string,
): LifecycleCheck {
  if (!chapter) {
    return { ok: false, code: "not_found", message: "Chapter not found." };
  }
  if (chapter.status === "closed") {
    return {
      ok: false,
      code: "conflict",
      message: "Chapter is already closed.",
    };
  }
  if (chapter.status !== "active") {
    return {
      ok: false,
      code: "conflict",
      message: "Only active chapters can be closed.",
    };
  }

  const date = isoDateSchema.safeParse(endedOn);
  if (!date.success) {
    return {
      ok: false,
      code: "validation",
      message: "End date must be a valid calendar date (YYYY-MM-DD).",
    };
  }
  if (date.data < chapter.started_on) {
    return {
      ok: false,
      code: "validation",
      message: "End date must be on or after the chapter start date.",
    };
  }
  return { ok: true };
}

/**
 * Decide whether a failed make-current attempt may restore the previous current.
 * Never restore when another chapter is already current (concurrent success).
 */
export function shouldRestorePreviousCurrent(input: {
  previousCurrentId: string | null;
  currentAfterFailureId: string | null;
  targetChapterId: string;
}): boolean {
  if (!input.previousCurrentId) return false;
  if (input.currentAfterFailureId === input.targetChapterId) return false;
  if (input.currentAfterFailureId != null) return false;
  return true;
}

/**
 * Classify make-current outcome after set attempt.
 * Avoids reporting success when the target is not current.
 */
export function classifyMakeCurrentResult(input: {
  targetChapterId: string;
  updatedRow: ChapterLifecycleView | null;
  currentAfterAttemptId: string | null;
  uniqueViolation: boolean;
}):
  | { kind: "success"; chapterId: string }
  | { kind: "already_current"; chapterId: string }
  | { kind: "conflict"; message: string } {
  if (input.updatedRow?.is_current && input.updatedRow.id === input.targetChapterId) {
    return { kind: "success", chapterId: input.targetChapterId };
  }
  if (input.currentAfterAttemptId === input.targetChapterId) {
    return { kind: "already_current", chapterId: input.targetChapterId };
  }
  if (input.uniqueViolation) {
    return {
      kind: "conflict",
      message:
        "Could not make this chapter current because another chapter is already current.",
    };
  }
  return {
    kind: "conflict",
    message: "Could not make this chapter current.",
  };
}
