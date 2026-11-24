import { describe, expect, it } from "vitest";
import {
  averageCheckInScores,
  buildWeeklyReviewSummary,
  countProjectStatuses,
  countTaskStatuses,
} from "@/modules/reviews/summary";

describe("averageCheckInScores", () => {
  it("returns nulls when empty and averages when present", () => {
    expect(averageCheckInScores([])).toEqual({
      count: 0,
      moodAvg: null,
      energyAvg: null,
      focusAvg: null,
    });
    expect(
      averageCheckInScores([
        { checkedOn: "2026-11-23", mood: 4, energy: 2, focus: 5 },
        { checkedOn: "2026-11-24", mood: 2, energy: 4, focus: 3 },
      ]),
    ).toEqual({
      count: 2,
      moodAvg: 3,
      energyAvg: 3,
      focusAvg: 4,
    });
  });
});

describe("status counters", () => {
  it("counts project and task statuses", () => {
    expect(
      countProjectStatuses([
        { status: "active" },
        { status: "done" },
        { status: "active" },
        { status: "paused" },
      ]),
    ).toEqual({ active: 2, paused: 1, done: 1, dropped: 0 });

    expect(
      countTaskStatuses([
        { status: "todo" },
        { status: "doing" },
        { status: "done" },
        { status: "cancelled" },
        { status: "todo" },
      ]),
    ).toEqual({ todo: 2, doing: 1, done: 1, cancelled: 1 });
  });
});

describe("buildWeeklyReviewSummary", () => {
  it("composes a display-only summary object", () => {
    const summary = buildWeeklyReviewSummary({
      periodStart: "2026-11-23",
      periodEnd: "2026-11-29",
      habits: [
        {
          habitId: "h1",
          habitName: "Run",
          scheduledOccurrences: 5,
          completedCount: 3,
          partialCount: 1,
          missedCount: 0,
          unloggedCount: 1,
          targetAttainment: 0.6,
          minimumAdherence: 0.8,
        },
      ],
      projects: [{ status: "active" }],
      tasks: [{ status: "todo" }, { status: "done" }],
      checkIns: [{ checkedOn: "2026-11-24", mood: 5, energy: 5, focus: 5 }],
    });
    expect(summary.periodStart).toBe("2026-11-23");
    expect(summary.habits).toHaveLength(1);
    expect(summary.projects.active).toBe(1);
    expect(summary.tasks.todo).toBe(1);
    expect(summary.checkIns.count).toBe(1);
    expect(summary.checkIns.moodAvg).toBe(5);
  });
});
