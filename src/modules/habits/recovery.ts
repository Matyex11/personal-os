import type { HabitLog, HabitLogStatus } from "@/types/domain";
import { AppError } from "@/lib/errors";

const RECOVERABLE_STATUSES: ReadonlySet<HabitLogStatus> = new Set(["missed", "partial"]);

export type CreateRecoveryInput = {
  userId: string;
  habitId: string;
  recoversLogId: string;
  loggedOn: string;
  value?: number | null;
  notes?: string;
};

export type RecoveryValidationResult =
  | { ok: true }
  | { ok: false; code: "not_found" | "forbidden" | "conflict" | "validation"; message: string };

/**
 * Domain rules for creating a recovery log linked to an existing habit log.
 * Does not mutate `original` — callers must never rewrite the source row.
 */
export function validateHabitRecovery(
  input: CreateRecoveryInput,
  original: HabitLog | null,
): RecoveryValidationResult {
  if (!original) {
    return { ok: false, code: "not_found", message: "Original habit log was not found." };
  }

  if (original.id !== input.recoversLogId) {
    return { ok: false, code: "validation", message: "Original log id mismatch." };
  }

  if (original.userId !== input.userId) {
    return {
      ok: false,
      code: "forbidden",
      message: "Recovery must target a log owned by the same user.",
    };
  }

  if (original.habitId !== input.habitId) {
    return {
      ok: false,
      code: "validation",
      message: "Recovery must target a log for the same habit.",
    };
  }

  if (!RECOVERABLE_STATUSES.has(original.status)) {
    return {
      ok: false,
      code: "conflict",
      message: "Recovery can only link to a missed or partial log.",
    };
  }

  return { ok: true };
}

/**
 * Builds a new recovery HabitLog draft. The original log must remain unchanged.
 */
export function buildHabitRecoveryLog(
  input: CreateRecoveryInput,
  original: HabitLog,
  newId: string,
): HabitLog {
  const check = validateHabitRecovery(input, original);
  if (!check.ok) {
    throw new AppError(check.code, check.message);
  }

  return {
    id: newId,
    userId: input.userId,
    habitId: input.habitId,
    loggedOn: input.loggedOn,
    status: "recovery",
    value: input.value ?? null,
    notes: input.notes,
    recoversLogId: original.id,
  };
}

/** Snapshot helper for tests/callers asserting immutability of the source log. */
export function assertOriginalLogUnchanged(before: HabitLog, after: HabitLog): void {
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    throw new AppError(
      "conflict",
      "Original habit log must remain unchanged when recording recovery.",
    );
  }
}
