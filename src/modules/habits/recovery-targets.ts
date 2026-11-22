import type { HabitLogStatus } from "@/types/domain";

export type RecoveryTargetLog = {
  id: string;
  logged_on: string;
  status: HabitLogStatus;
  recovers_log_id?: string | null;
};

export type EligibleRecoveryTarget = {
  id: string;
  logged_on: string;
  status: "missed" | "partial";
};

const RECOVERABLE = new Set<HabitLogStatus>(["missed", "partial"]);

/**
 * Eligible recovery targets for one habit's log list.
 * Only missed/partial rows that are not already recovered.
 * Client filter for UX — server must re-validate ownership + status.
 */
export function listEligibleRecoveryTargets(
  logs: readonly RecoveryTargetLog[],
): EligibleRecoveryTarget[] {
  const alreadyRecovered = new Set(
    logs
      .filter((log) => log.status === "recovery" && log.recovers_log_id)
      .map((log) => log.recovers_log_id as string),
  );

  return logs
    .filter(
      (log) =>
        RECOVERABLE.has(log.status) &&
        !alreadyRecovered.has(log.id) &&
        (log.status === "missed" || log.status === "partial"),
    )
    .map((log) => ({
      id: log.id,
      logged_on: log.logged_on,
      status: log.status as "missed" | "partial",
    }))
    .sort((a, b) => (a.logged_on < b.logged_on ? 1 : a.logged_on > b.logged_on ? -1 : 0));
}

export function formatRecoveryTargetLabel(target: EligibleRecoveryTarget): string {
  return `${target.logged_on} · ${target.status}`;
}

/**
 * Human-readable history line. Recovery rows annotate the original date/status
 * when the original is present in `byId`.
 */
export function formatHabitLogHistoryLine(
  log: RecoveryTargetLog,
  byId: ReadonlyMap<string, RecoveryTargetLog>,
): string {
  if (log.status === "recovery" && log.recovers_log_id) {
    const original = byId.get(log.recovers_log_id);
    if (original) {
      return `${log.logged_on} · recovery → ${original.logged_on} (${original.status})`;
    }
    return `${log.logged_on} · recovery → original unavailable`;
  }
  return `${log.logged_on} · ${log.status}`;
}

/** Prefer active habits; fall back to all when none are active. */
export function selectEligibleHabits<T extends { is_active: boolean }>(habits: readonly T[]): T[] {
  const active = habits.filter((habit) => habit.is_active);
  return active.length > 0 ? [...active] : [...habits];
}
