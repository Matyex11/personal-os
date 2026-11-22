import type { HabitLogStatus } from "@/types/domain";

/** Primary outcomes that count toward the scheduled-occurrence denominator. */
export type ScheduledOutcome = "completed" | "partial" | "missed" | "unlogged";

export type AdherenceContribution = {
  includeInDenominator: boolean;
  countsTowardTarget: boolean;
  countsTowardMinimum: boolean;
  streakKind: "full" | "partial" | "break" | "neutral" | "recovery_event";
};

export type HabitLogLike = {
  loggedOn: string;
  status: HabitLogStatus;
};

export type OccurrenceRow = {
  date: string;
  outcome: ScheduledOutcome;
};

export type AdherenceSummary = {
  /** Expected scheduled occurrences in the window (denominator). */
  scheduledOccurrences: number;
  completedCount: number;
  partialCount: number;
  missedCount: number;
  unloggedCount: number;
  /** completed / scheduledOccurrences; null when denominator is 0. */
  targetAttainment: number | null;
  /** (completed + partial) / scheduledOccurrences; null when denominator is 0. */
  minimumAdherence: number | null;
  /** Scheduled dates with no primary recorded log. */
  unloggedDates: string[];
  occurrences: OccurrenceRow[];
};

/**
 * Classify a recorded primary status for reporting.
 * Recovery never enters the historical denominator or numerators.
 */
export function adherenceContribution(status: HabitLogStatus): AdherenceContribution {
  switch (status) {
    case "completed":
      return {
        includeInDenominator: true,
        countsTowardTarget: true,
        countsTowardMinimum: true,
        streakKind: "full",
      };
    case "partial":
      return {
        includeInDenominator: true,
        countsTowardTarget: false,
        countsTowardMinimum: true,
        streakKind: "partial",
      };
    case "missed":
      return {
        includeInDenominator: true,
        countsTowardTarget: false,
        countsTowardMinimum: false,
        streakKind: "break",
      };
    case "not_scheduled":
      return {
        includeInDenominator: false,
        countsTowardTarget: false,
        countsTowardMinimum: false,
        streakKind: "neutral",
      };
    case "recovery":
      return {
        includeInDenominator: false,
        countsTowardTarget: false,
        countsTowardMinimum: false,
        streakKind: "recovery_event",
      };
  }
}

/** Unlogged scheduled occurrences count in the denominator with zero on both metrics. */
export function unloggedContribution(): AdherenceContribution {
  return {
    includeInDenominator: true,
    countsTowardTarget: false,
    countsTowardMinimum: false,
    streakKind: "break",
  };
}

/**
 * Pick the primary (non-recovery) log status for a date.
 * Recovery rows are ignored so they never rewrite historical adherence.
 */
export function primaryStatusForDate(
  date: string,
  logs: HabitLogLike[],
): HabitLogStatus | null {
  const primary = logs.find(
    (log) => log.loggedOn === date && log.status !== "recovery",
  );
  return primary?.status ?? null;
}

function outcomeFromStatus(status: HabitLogStatus | null): ScheduledOutcome | "excluded" {
  if (status === null) return "unlogged";
  const contribution = adherenceContribution(status);
  if (!contribution.includeInDenominator) return "excluded";
  if (status === "completed" || status === "partial" || status === "missed") {
    return status;
  }
  return "excluded";
}

/**
 * Summarize adherence against **expected scheduled occurrences**, not merely
 * existing log rows. Missing primary logs surface as `unlogged`.
 *
 * Metrics (R005 resolved):
 * - targetAttainment = completed / scheduledOccurrences
 * - minimumAdherence = (completed + partial) / scheduledOccurrences
 *
 * Missed and unlogged contribute 0 to both numerators.
 * `not_scheduled` and `recovery` never enter the denominator.
 * This function is read-only — it does not backfill or mutate logs.
 */
export function summarizeAdherence(input: {
  scheduledDates: string[];
  logs: HabitLogLike[];
}): AdherenceSummary {
  const uniqueScheduled = [...new Set(input.scheduledDates)].sort();
  const occurrences: OccurrenceRow[] = [];
  const unloggedDates: string[] = [];

  let completedCount = 0;
  let partialCount = 0;
  let missedCount = 0;
  let unloggedCount = 0;
  let scheduledOccurrences = 0;

  for (const date of uniqueScheduled) {
    const status = primaryStatusForDate(date, input.logs);
    const outcome = outcomeFromStatus(status);

    if (outcome === "excluded") {
      // Expected schedule listed a date that was recorded as not_scheduled
      // (or only has recovery). Exclude from denominator; do not invent rows.
      continue;
    }

    scheduledOccurrences += 1;
    occurrences.push({ date, outcome });

    switch (outcome) {
      case "completed":
        completedCount += 1;
        break;
      case "partial":
        partialCount += 1;
        break;
      case "missed":
        missedCount += 1;
        break;
      case "unlogged":
        unloggedCount += 1;
        unloggedDates.push(date);
        break;
    }
  }

  return {
    scheduledOccurrences,
    completedCount,
    partialCount,
    missedCount,
    unloggedCount,
    targetAttainment:
      scheduledOccurrences === 0 ? null : completedCount / scheduledOccurrences,
    minimumAdherence:
      scheduledOccurrences === 0
        ? null
        : (completedCount + partialCount) / scheduledOccurrences,
    unloggedDates,
    occurrences,
  };
}
