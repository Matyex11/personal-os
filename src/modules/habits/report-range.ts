import { z } from "zod";
import { inclusiveDaySpan } from "@/lib/dates/calendar";
import { isoDateSchema, uuidSchema } from "@/lib/validation/common";

/** Inclusive max span for habit adherence reports. */
export const HABIT_REPORT_MAX_DAYS = 366;

function refineReportDates(todayOn: string) {
  return (
    value: { fromOn: string; toOn: string },
    ctx: z.RefinementCtx,
  ): void => {
    // Field-level isoDateSchema may still leave invalid values visible here (Zod 4).
    const fromOk = isoDateSchema.safeParse(value.fromOn).success;
    const toOk = isoDateSchema.safeParse(value.toOn).success;
    if (!fromOk || !toOk) return;

    if (value.fromOn > value.toOn) {
      ctx.addIssue({
        code: "custom",
        message: "Start date must be on or before end date.",
        path: ["fromOn"],
      });
      return;
    }

    if (value.fromOn > todayOn) {
      ctx.addIssue({
        code: "custom",
        message: "Start date cannot be in the future.",
        path: ["fromOn"],
      });
    }

    if (value.toOn > todayOn) {
      ctx.addIssue({
        code: "custom",
        message: "End date cannot be in the future.",
        path: ["toOn"],
      });
    }

    const days = inclusiveDaySpan(value.fromOn, value.toOn);
    if (days > HABIT_REPORT_MAX_DAYS) {
      ctx.addIssue({
        code: "custom",
        message: `Date range cannot exceed ${HABIT_REPORT_MAX_DAYS} days.`,
        path: ["toOn"],
      });
    }
  };
}

/** from/to only — used for query resolution and shared with the full report schema. */
export function createHabitReportDatesSchema(todayOn: string) {
  isoDateSchema.parse(todayOn);
  return z
    .object({
      fromOn: isoDateSchema,
      toOn: isoDateSchema,
    })
    .superRefine(refineReportDates(todayOn));
}

/**
 * Builds a report-range schema bound to "today" in the profile time zone.
 * Rejects invalid calendars (via isoDateSchema), start>end, future dates, and >366 days.
 */
export function createHabitReportRangeSchema(todayOn: string) {
  isoDateSchema.parse(todayOn);
  return z
    .object({
      habitId: uuidSchema,
      fromOn: isoDateSchema,
      toOn: isoDateSchema,
    })
    .superRefine(refineReportDates(todayOn));
}

export type HabitReportRangeInput = z.infer<
  ReturnType<typeof createHabitReportRangeSchema>
>;

export function firstZodIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid date range.";
}

export type ResolvedHabitReportRange =
  | {
      ok: true;
      fromOn: string;
      toOn: string;
      /** Values to show in the range form (same as validated). */
      formFrom: string;
      formTo: string;
    }
  | {
      ok: false;
      message: string;
      /** Preserve user-entered query values for the form / error copy. */
      formFrom: string;
      formTo: string;
    };

/**
 * Resolve `from`/`to` query params for the Habits reporting panel.
 * Missing keys use defaults; explicitly supplied invalid values never silently default.
 */
export function resolveHabitReportRangeQuery(input: {
  from: string | undefined;
  to: string | undefined;
  todayOn: string;
  defaultFromOn: string;
}): ResolvedHabitReportRange {
  const fromProvided = input.from !== undefined;
  const toProvided = input.to !== undefined;

  const fromOn = fromProvided ? input.from! : input.defaultFromOn;
  const toOn = toProvided ? input.to! : input.todayOn;
  const formFrom = fromOn;
  const formTo = toOn;

  const parsed = createHabitReportDatesSchema(input.todayOn).safeParse({
    fromOn,
    toOn,
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: firstZodIssueMessage(parsed.error),
      formFrom,
      formTo,
    };
  }

  return {
    ok: true,
    fromOn: parsed.data.fromOn,
    toOn: parsed.data.toOn,
    formFrom: parsed.data.fromOn,
    formTo: parsed.data.toOn,
  };
}
