import { describe, expect, it } from "vitest";
import { adherenceContribution, summarizeAdherence } from "@/modules/habits/reporting";

describe("habit adherence reporting", () => {
  it("treats completed as full credit", () => {
    expect(adherenceContribution("completed")).toEqual({
      includeInDenominator: true,
      credit: 1,
      streakKind: "full",
    });
  });

  it("keeps missed in the denominator with zero credit", () => {
    expect(adherenceContribution("missed")).toEqual({
      includeInDenominator: true,
      credit: 0,
      streakKind: "break",
    });
  });

  it("excludes recovery from historical denominator", () => {
    expect(adherenceContribution("recovery").includeInDenominator).toBe(false);
  });

  it("summarizes mixed statuses without rewriting misses", () => {
    const summary = summarizeAdherence([
      "completed",
      "missed",
      "partial",
      "not_scheduled",
      "recovery",
    ]);

    expect(summary.scheduledDays).toBe(3);
    expect(summary.credit).toBe(1.5);
    expect(summary.rate).toBeCloseTo(0.5);
  });
});
