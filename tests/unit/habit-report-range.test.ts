import { describe, expect, it } from "vitest";
import {
  createHabitReportRangeSchema,
  firstZodIssueMessage,
  HABIT_REPORT_MAX_DAYS,
  resolveHabitReportRangeQuery,
} from "@/modules/habits/report-range";

const habitId = "33333333-3333-4333-8333-333333333333";
const todayOn = "2026-11-22";
const defaultFromOn = "2026-11-01";
const schema = createHabitReportRangeSchema(todayOn);

describe("createHabitReportRangeSchema", () => {
  it("accepts a valid inclusive range ending on today", () => {
    const parsed = schema.parse({
      habitId,
      fromOn: "2026-11-01",
      toOn: todayOn,
    });
    expect(parsed.fromOn).toBe("2026-11-01");
    expect(parsed.toOn).toBe(todayOn);
  });

  it("rejects start after end", () => {
    const result = schema.safeParse({
      habitId,
      fromOn: "2026-11-20",
      toOn: "2026-11-10",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(firstZodIssueMessage(result.error)).toMatch(/on or before/i);
    }
  });

  it("rejects invalid calendar dates including 2026-02-30", () => {
    expect(
      schema.safeParse({ habitId, fromOn: "2026-02-30", toOn: todayOn }).success,
    ).toBe(false);
    expect(
      schema.safeParse({ habitId, fromOn: "2026-02-31", toOn: todayOn }).success,
    ).toBe(false);
  });

  it("rejects invalid leap days and accepts valid leap days", () => {
    expect(
      schema.safeParse({
        habitId,
        fromOn: "2025-02-29",
        toOn: "2025-03-01",
      }).success,
    ).toBe(false);
    expect(
      schema.safeParse({
        habitId,
        fromOn: "2024-02-29",
        toOn: "2024-03-01",
      }).success,
    ).toBe(true);
  });

  it("rejects future end dates relative to profile today", () => {
    const result = schema.safeParse({
      habitId,
      fromOn: "2026-11-01",
      toOn: "2026-11-23",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(firstZodIssueMessage(result.error)).toMatch(/future/i);
    }
  });

  it("rejects future start dates", () => {
    const result = schema.safeParse({
      habitId,
      fromOn: "2026-11-23",
      toOn: "2026-11-23",
    });
    expect(result.success).toBe(false);
  });

  it(`accepts exactly ${HABIT_REPORT_MAX_DAYS} inclusive days`, () => {
    // 2025-11-22 → 2026-11-22 inclusive = 366
    const parsed = schema.parse({
      habitId,
      fromOn: "2025-11-22",
      toOn: todayOn,
    });
    expect(parsed.fromOn).toBe("2025-11-22");
  });

  it("rejects 367 inclusive days", () => {
    const result = schema.safeParse({
      habitId,
      fromOn: "2025-11-21",
      toOn: todayOn,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(firstZodIssueMessage(result.error)).toMatch(/366/);
    }
  });
});

describe("resolveHabitReportRangeQuery", () => {
  it("uses defaults when from/to are missing", () => {
    const resolved = resolveHabitReportRangeQuery({
      from: undefined,
      to: undefined,
      todayOn,
      defaultFromOn,
    });
    expect(resolved).toEqual({
      ok: true,
      fromOn: defaultFromOn,
      toOn: todayOn,
      formFrom: defaultFromOn,
      formTo: todayOn,
    });
  });

  it("defaults only the missing side when one param is supplied", () => {
    const resolved = resolveHabitReportRangeQuery({
      from: "2026-11-10",
      to: undefined,
      todayOn,
      defaultFromOn,
    });
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.fromOn).toBe("2026-11-10");
      expect(resolved.toOn).toBe(todayOn);
    }
  });

  it("does not silently default explicitly invalid dates", () => {
    const resolved = resolveHabitReportRangeQuery({
      from: "2026-02-30",
      to: todayOn,
      todayOn,
      defaultFromOn,
    });
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) {
      expect(resolved.formFrom).toBe("2026-02-30");
      expect(resolved.formTo).toBe(todayOn);
      expect(resolved.message.length).toBeGreaterThan(0);
      expect(resolved.formFrom).not.toBe(defaultFromOn);
    }
  });

  it("rejects explicit empty strings instead of treating them as missing", () => {
    const resolved = resolveHabitReportRangeQuery({
      from: "",
      to: "",
      todayOn,
      defaultFromOn,
    });
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) {
      expect(resolved.formFrom).toBe("");
      expect(resolved.formTo).toBe("");
    }
  });

  it("surfaces start>end without substituting defaults", () => {
    const resolved = resolveHabitReportRangeQuery({
      from: "2026-11-20",
      to: "2026-11-10",
      todayOn,
      defaultFromOn,
    });
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) {
      expect(resolved.formFrom).toBe("2026-11-20");
      expect(resolved.formTo).toBe("2026-11-10");
      expect(resolved.message).toMatch(/on or before/i);
    }
  });

  it("rejects future ranges relative to profile TZ today", () => {
    const resolved = resolveHabitReportRangeQuery({
      from: "2026-11-01",
      to: "2026-11-23",
      todayOn,
      defaultFromOn,
    });
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) {
      expect(resolved.message).toMatch(/future/i);
    }
  });
});
