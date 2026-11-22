import type { HabitLogStatus } from "@/types/domain";

export type AdherenceContribution = {
  includeInDenominator: boolean;
  credit: number;
  streakKind: "full" | "partial" | "break" | "neutral" | "recovery_event";
};

export type AdherenceOptions = {
  /**
   * Credit applied for `partial` logs when included in the denominator.
   * **Provisional** default `0.5` until product decision R005 is resolved.
   * Callers should pass an explicit value once profile/settings exist.
   */
  partialCredit?: number;
};

/** Provisional stand-in for R005 — not a finalized product policy. */
export const PROVISIONAL_PARTIAL_CREDIT = 0.5;

/**
 * Pure reporting rules for habit statuses.
 * Recovery never rewrites a historical miss — it is a separate event.
 */
export function adherenceContribution(
  status: HabitLogStatus,
  options: AdherenceOptions = {},
): AdherenceContribution {
  const partialCredit = options.partialCredit ?? PROVISIONAL_PARTIAL_CREDIT;

  switch (status) {
    case "completed":
      return { includeInDenominator: true, credit: 1, streakKind: "full" };
    case "partial":
      return { includeInDenominator: true, credit: partialCredit, streakKind: "partial" };
    case "missed":
      return { includeInDenominator: true, credit: 0, streakKind: "break" };
    case "not_scheduled":
      return { includeInDenominator: false, credit: 0, streakKind: "neutral" };
    case "recovery":
      return { includeInDenominator: false, credit: 0, streakKind: "recovery_event" };
  }
}

export function summarizeAdherence(
  statuses: HabitLogStatus[],
  options: AdherenceOptions = {},
): { scheduledDays: number; credit: number; rate: number | null } {
  let scheduledDays = 0;
  let credit = 0;

  for (const status of statuses) {
    const row = adherenceContribution(status, options);
    if (row.includeInDenominator) {
      scheduledDays += 1;
      credit += row.credit;
    }
  }

  return {
    scheduledDays,
    credit,
    rate: scheduledDays === 0 ? null : credit / scheduledDays,
  };
}
