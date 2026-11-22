import { z } from "zod";
import { isoDateSchema } from "@/lib/validation/common";

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export const isoWeekdaySchema = z.number().int().min(1).max(7);

export const habitCadenceSchema = z
  .object({
    kind: z.enum(["daily", "weekdays"]),
    /** Required when kind = weekdays; ignored for daily. */
    weekdays: z.array(isoWeekdaySchema).min(1).max(7).optional(),
    /** Inclusive schedule start (YYYY-MM-DD in habit/profile intent). */
    startOn: isoDateSchema,
    /** Inclusive schedule end; omit/null = open-ended. */
    endOn: isoDateSchema.nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.kind === "weekdays") {
      if (!value.weekdays || value.weekdays.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: "weekdays cadence requires at least one weekday",
          path: ["weekdays"],
        });
      }
    }
    if (value.endOn && value.endOn < value.startOn) {
      ctx.addIssue({
        code: "custom",
        message: "endOn must be on or after startOn",
        path: ["endOn"],
      });
    }
  });

export type HabitCadence = z.infer<typeof habitCadenceSchema>;

export type ScheduleWindow = {
  fromOn: string;
  toOn: string;
  /** IANA TZ used to interpret calendar weekdays for generation. */
  timeZone: string;
};

function parseIsoDate(value: string): { y: number; m: number; d: number } {
  const [y, m, d] = value.split("-").map(Number);
  return { y: y!, m: m!, d: d! };
}

function formatIsoDate(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function addUtcDays(y: number, m: number, d: number, days: number): { y: number; m: number; d: number } {
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

/** ISO weekday 1–7 for a civil date (date arithmetic in UTC civil calendar). */
export function isoWeekdayForCivilDate(isoDate: string): number {
  const { y, m, d } = parseIsoDate(isoDate);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const js = dt.getUTCDay(); // 0 Sun … 6 Sat
  return js === 0 ? 7 : js;
}

function maxDate(a: string, b: string): string {
  return a >= b ? a : b;
}

function minDate(a: string, b: string): string {
  return a <= b ? a : b;
}

/**
 * Generate expected scheduled occurrence dates for one habit in a window.
 *
 * v1 notes:
 * - Uses the **current** cadence definition (no historical schedule versions).
 * - Changing cadence does **not** mutate existing logs; it only changes which
 *   future/past dates are considered expected when regenerating a report window.
 * - Civil dates are generated on the Gregorian calendar; `timeZone` is accepted
 *   for API/profile consistency (weekday mapping uses civil ISO dates).
 * - `not_scheduled` overrides are applied later in reporting via logs, not here.
 */
export function generateScheduledDates(
  cadence: HabitCadence,
  window: ScheduleWindow,
): string[] {
  const parsed = habitCadenceSchema.parse(cadence);
  const fromOn = maxDate(window.fromOn, parsed.startOn);
  const toOn = parsed.endOn ? minDate(window.toOn, parsed.endOn) : window.toOn;
  if (fromOn > toOn) return [];

  const weekdays =
    parsed.kind === "daily"
      ? new Set([1, 2, 3, 4, 5, 6, 7])
      : new Set(parsed.weekdays ?? []);

  const out: string[] = [];
  let cursor = parseIsoDate(fromOn);
  const end = parseIsoDate(toOn);

  while (
    cursor.y < end.y ||
    (cursor.y === end.y && cursor.m < end.m) ||
    (cursor.y === end.y && cursor.m === end.m && cursor.d <= end.d)
  ) {
    const iso = formatIsoDate(cursor.y, cursor.m, cursor.d);
    const weekday = isoWeekdayForCivilDate(iso);
    if (weekdays.has(weekday)) {
      out.push(iso);
    }
    cursor = addUtcDays(cursor.y, cursor.m, cursor.d, 1);
  }

  return out;
}
