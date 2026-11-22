import type { HabitLogStatus } from "@/types/domain";

export type AdherenceContribution = {
  includeInDenominator: boolean;
  credit: number;
  streakKind: "full" | "partial" | "break" | "neutral" | "recovery_event";
};

/**
 * Pure reporting rules for habit statuses.
 * Recovery never rewrites a historical miss — it is a separate event.
 */
export function adherenceContribution(status: HabitLogStatus): AdherenceContribution {
  switch (status) {
    case "completed":
      return { includeInDenominator: true, credit: 1, streakKind: "full" };
    case "partial":
      return { includeInDenominator: true, credit: 0.5, streakKind: "partial" };
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
): { scheduledDays: number; credit: number; rate: number | null } {
  let scheduledDays = 0;
  let credit = 0;

  for (const status of statuses) {
    const row = adherenceContribution(status);
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
