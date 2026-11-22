import { describe, expect, it } from "vitest";
import {
  generateScheduledDates,
  habitCadenceSchema,
  isoWeekdayForCivilDate,
} from "@/modules/habits/cadence";
import { summarizeAdherence } from "@/modules/habits/reporting";

describe("habit cadence v1", () => {
  it("parses daily and weekdays cadence", () => {
    expect(
      habitCadenceSchema.safeParse({
        kind: "daily",
        startOn: "2026-11-01",
      }).success,
    ).toBe(true);

    expect(
      habitCadenceSchema.safeParse({
        kind: "weekdays",
        weekdays: [1, 3, 5],
        startOn: "2026-11-01",
        endOn: "2026-11-30",
      }).success,
    ).toBe(true);

    expect(
      habitCadenceSchema.safeParse({
        kind: "weekdays",
        startOn: "2026-11-01",
      }).success,
    ).toBe(false);
  });

  it("maps civil dates to ISO weekdays", () => {
    // 2026-11-23 is a Monday
    expect(isoWeekdayForCivilDate("2026-11-23")).toBe(1);
    expect(isoWeekdayForCivilDate("2026-11-22")).toBe(7);
  });

  it("generates daily dates within schedule and window", () => {
    const dates = generateScheduledDates(
      { kind: "daily", startOn: "2026-11-20", endOn: "2026-11-22" },
      { fromOn: "2026-11-01", toOn: "2026-11-30", timeZone: "Europe/Bucharest" },
    );
    expect(dates).toEqual(["2026-11-20", "2026-11-21", "2026-11-22"]);
  });

  it("generates selected weekdays only", () => {
    const dates = generateScheduledDates(
      { kind: "weekdays", weekdays: [1, 2], startOn: "2026-11-23" },
      { fromOn: "2026-11-23", toOn: "2026-11-29", timeZone: "Europe/Bucharest" },
    );
    // Mon 23, Tue 24 only in that week from start
    expect(dates).toEqual(["2026-11-23", "2026-11-24"]);
  });

  it("integrates schedule generation with adherence reporting and unlogged days", () => {
    const scheduledDates = generateScheduledDates(
      { kind: "daily", startOn: "2026-11-20" },
      { fromOn: "2026-11-20", toOn: "2026-11-22", timeZone: "Europe/Bucharest" },
    );

    const summary = summarizeAdherence({
      scheduledDates,
      logs: [
        { loggedOn: "2026-11-20", status: "completed" },
        { loggedOn: "2026-11-21", status: "not_scheduled" },
      ],
    });

    // 20 completed, 21 excluded via not_scheduled override, 22 unlogged
    expect(summary.scheduledOccurrences).toBe(2);
    expect(summary.completedCount).toBe(1);
    expect(summary.unloggedCount).toBe(1);
    expect(summary.unloggedDates).toEqual(["2026-11-22"]);
    expect(summary.targetAttainment).toBeCloseTo(0.5);
    expect(summary.minimumAdherence).toBeCloseTo(0.5);
  });
});
