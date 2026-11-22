import { describe, expect, it } from "vitest";
import {
  PROVISIONAL_PARTIAL_CREDIT,
  adherenceContribution,
  summarizeAdherence,
} from "@/modules/habits/reporting";

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

  it("uses provisional partial credit by default without finalizing R005", () => {
    expect(PROVISIONAL_PARTIAL_CREDIT).toBe(0.5);
    expect(adherenceContribution("partial").credit).toBe(PROVISIONAL_PARTIAL_CREDIT);
  });

  it("allows overriding partial credit explicitly", () => {
    expect(adherenceContribution("partial", { partialCredit: 0 }).credit).toBe(0);
    expect(adherenceContribution("partial", { partialCredit: 1 }).credit).toBe(1);
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

  it("honors configured partial credit in summaries", () => {
    const summary = summarizeAdherence(["partial", "completed"], { partialCredit: 0 });
    expect(summary.scheduledDays).toBe(2);
    expect(summary.credit).toBe(1);
    expect(summary.rate).toBeCloseTo(0.5);
  });
});
