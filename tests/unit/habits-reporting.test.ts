import { describe, expect, it } from "vitest";
import {
  adherenceContribution,
  primaryStatusForDate,
  summarizeAdherence,
  unloggedContribution,
} from "@/modules/habits/reporting";

describe("adherenceContribution (R005 dual metrics)", () => {
  it("counts completed toward target and minimum", () => {
    expect(adherenceContribution("completed")).toEqual({
      includeInDenominator: true,
      countsTowardTarget: true,
      countsTowardMinimum: true,
      streakKind: "full",
    });
  });

  it("counts partial toward minimum only", () => {
    expect(adherenceContribution("partial")).toEqual({
      includeInDenominator: true,
      countsTowardTarget: false,
      countsTowardMinimum: true,
      streakKind: "partial",
    });
  });

  it("gives missed zero on both metrics while keeping it in the denominator", () => {
    expect(adherenceContribution("missed")).toEqual({
      includeInDenominator: true,
      countsTowardTarget: false,
      countsTowardMinimum: false,
      streakKind: "break",
    });
  });

  it("excludes not_scheduled and recovery from the denominator", () => {
    expect(adherenceContribution("not_scheduled").includeInDenominator).toBe(false);
    expect(adherenceContribution("recovery").includeInDenominator).toBe(false);
  });

  it("treats unlogged like a denominator zero on both metrics", () => {
    expect(unloggedContribution()).toMatchObject({
      includeInDenominator: true,
      countsTowardTarget: false,
      countsTowardMinimum: false,
    });
  });
});

describe("summarizeAdherence", () => {
  it("computes target attainment and minimum adherence separately", () => {
    const summary = summarizeAdherence({
      scheduledDates: ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04"],
      logs: [
        { loggedOn: "2026-11-01", status: "completed" },
        { loggedOn: "2026-11-02", status: "partial" },
        { loggedOn: "2026-11-03", status: "missed" },
        // 2026-11-04 unlogged
      ],
    });

    expect(summary.scheduledOccurrences).toBe(4);
    expect(summary.completedCount).toBe(1);
    expect(summary.partialCount).toBe(1);
    expect(summary.missedCount).toBe(1);
    expect(summary.unloggedCount).toBe(1);
    expect(summary.unloggedDates).toEqual(["2026-11-04"]);
    // target = completed/4 = 0.25
    expect(summary.targetAttainment).toBeCloseTo(0.25);
    // minimum = (completed+partial)/4 = 0.5
    expect(summary.minimumAdherence).toBeCloseTo(0.5);
  });

  it("does not silently omit unlogged scheduled occurrences", () => {
    const summary = summarizeAdherence({
      scheduledDates: ["2026-11-10", "2026-11-11"],
      logs: [{ loggedOn: "2026-11-10", status: "completed" }],
    });

    expect(summary.occurrences).toEqual([
      { date: "2026-11-10", outcome: "completed" },
      { date: "2026-11-11", outcome: "unlogged" },
    ]);
    expect(summary.unloggedCount).toBe(1);
  });

  it("ignores recovery logs so they never alter historical adherence", () => {
    const summary = summarizeAdherence({
      scheduledDates: ["2026-11-20"],
      logs: [
        { loggedOn: "2026-11-20", status: "missed" },
        { loggedOn: "2026-11-22", status: "recovery" },
      ],
    });

    expect(summary.occurrences).toEqual([{ date: "2026-11-20", outcome: "missed" }]);
    expect(summary.targetAttainment).toBe(0);
    expect(summary.minimumAdherence).toBe(0);
    // Recovery on another day is irrelevant to the historical miss.
    expect(summary.completedCount).toBe(0);
  });

  it("uses primary status when a recovery shares the calendar day", () => {
    const logs = [
      { loggedOn: "2026-11-20", status: "missed" as const },
      { loggedOn: "2026-11-20", status: "recovery" as const },
    ];
    expect(primaryStatusForDate("2026-11-20", logs)).toBe("missed");

    const summary = summarizeAdherence({
      scheduledDates: ["2026-11-20"],
      logs,
    });
    expect(summary.occurrences[0]?.outcome).toBe("missed");
  });

  it("excludes not_scheduled from the denominator even if listed", () => {
    const summary = summarizeAdherence({
      scheduledDates: ["2026-11-01", "2026-11-02"],
      logs: [
        { loggedOn: "2026-11-01", status: "completed" },
        { loggedOn: "2026-11-02", status: "not_scheduled" },
      ],
    });

    expect(summary.scheduledOccurrences).toBe(1);
    expect(summary.targetAttainment).toBe(1);
    expect(summary.minimumAdherence).toBe(1);
  });

  it("returns null rates when there are no scheduled occurrences", () => {
    const summary = summarizeAdherence({ scheduledDates: [], logs: [] });
    expect(summary.scheduledOccurrences).toBe(0);
    expect(summary.targetAttainment).toBeNull();
    expect(summary.minimumAdherence).toBeNull();
  });

  it("deduplicates scheduled dates", () => {
    const summary = summarizeAdherence({
      scheduledDates: ["2026-11-01", "2026-11-01"],
      logs: [{ loggedOn: "2026-11-01", status: "completed" }],
    });
    expect(summary.scheduledOccurrences).toBe(1);
  });
});
