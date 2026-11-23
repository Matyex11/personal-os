import { habitCadenceSchema, generateScheduledDates } from "@/modules/habits/cadence";
import { primaryStatusForDate, type HabitLogLike } from "@/modules/habits/reporting";
import type { HabitCadence } from "@/modules/habits/cadence";

/** Dashboard outcome for one active habit on a single calendar day. */
export type TodayHabitOutcome =
  | "completed"
  | "partial"
  | "missed"
  | "unlogged"
  | "not_scheduled";

export type TodayHabitRow = {
  habitId: string;
  name: string;
  outcome: TodayHabitOutcome;
  /** True when a recovery row exists for this habit on the same calendar day. */
  recoveryLoggedToday: boolean;
  scheduledToday: boolean;
};

export type HabitTodayInput = {
  id: string;
  name: string;
  is_active: boolean;
  cadence: HabitCadence | unknown;
};

/**
 * Classify every active habit for `todayOn` using cadence + primary log semantics.
 * Recovery rows never become the outcome; they only set `recoveryLoggedToday`.
 */
export function buildTodaysHabitRows(input: {
  habits: HabitTodayInput[];
  logs: Array<HabitLogLike & { habitId: string }>;
  todayOn: string;
  timeZone: string;
}): TodayHabitRow[] {
  const active = input.habits.filter((habit) => habit.is_active);

  return active.map((habit) => {
    const cadence = habitCadenceSchema.parse(habit.cadence);
    const scheduledDates = generateScheduledDates(cadence, {
      fromOn: input.todayOn,
      toOn: input.todayOn,
      timeZone: input.timeZone,
    });
    const scheduledToday = scheduledDates.includes(input.todayOn);

    const habitLogs = input.logs.filter((log) => log.habitId === habit.id);
    const primary = primaryStatusForDate(input.todayOn, habitLogs);
    const recoveryLoggedToday = habitLogs.some(
      (log) => log.loggedOn === input.todayOn && log.status === "recovery",
    );

    let outcome: TodayHabitOutcome;
    if (primary === "completed" || primary === "partial" || primary === "missed") {
      outcome = primary;
    } else if (scheduledToday && primary === null) {
      outcome = "unlogged";
    } else {
      outcome = "not_scheduled";
    }

    return {
      habitId: habit.id,
      name: habit.name,
      outcome,
      recoveryLoggedToday,
      scheduledToday,
    };
  });
}
