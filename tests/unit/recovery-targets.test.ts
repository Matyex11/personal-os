import { describe, expect, it } from "vitest";
import {
  formatHabitLogHistoryLine,
  formatRecoveryTargetLabel,
  listEligibleRecoveryTargets,
  selectEligibleHabits,
} from "@/modules/habits/recovery-targets";

describe("listEligibleRecoveryTargets", () => {
  const logs = [
    {
      id: "m1",
      logged_on: "2026-11-20",
      status: "missed" as const,
      recovers_log_id: null,
    },
    {
      id: "p1",
      logged_on: "2026-11-21",
      status: "partial" as const,
      recovers_log_id: null,
    },
    {
      id: "c1",
      logged_on: "2026-11-19",
      status: "completed" as const,
      recovers_log_id: null,
    },
    {
      id: "r1",
      logged_on: "2026-11-22",
      status: "recovery" as const,
      recovers_log_id: "m1",
    },
  ];

  it("returns only unrecovered missed/partial, newest first", () => {
    expect(listEligibleRecoveryTargets(logs)).toEqual([
      { id: "p1", logged_on: "2026-11-21", status: "partial" },
    ]);
  });

  it("excludes completed, not_scheduled, and recovery rows", () => {
    const targets = listEligibleRecoveryTargets([
      ...logs,
      {
        id: "ns1",
        logged_on: "2026-11-18",
        status: "not_scheduled" as const,
        recovers_log_id: null,
      },
    ]);
    expect(targets.every((t) => t.status === "missed" || t.status === "partial")).toBe(
      true,
    );
    expect(targets.find((t) => t.id === "m1")).toBeUndefined();
  });
});

describe("format helpers", () => {
  it("labels recovery targets for the select", () => {
    expect(
      formatRecoveryTargetLabel({
        id: "x",
        logged_on: "2026-11-20",
        status: "missed",
      }),
    ).toBe("2026-11-20 · missed");
  });

  it("describes recovery history with original date/status", () => {
    const byId = new Map([
      [
        "m1",
        {
          id: "m1",
          logged_on: "2026-11-20",
          status: "missed" as const,
          recovers_log_id: null,
        },
      ],
    ]);
    expect(
      formatHabitLogHistoryLine(
        {
          id: "r1",
          logged_on: "2026-11-22",
          status: "recovery",
          recovers_log_id: "m1",
        },
        byId,
      ),
    ).toBe("2026-11-22 · recovery → 2026-11-20 (missed)");
  });
});

describe("selectEligibleHabits", () => {
  it("prefers active habits", () => {
    const habits = [
      { id: "a", is_active: false },
      { id: "b", is_active: true },
    ];
    expect(selectEligibleHabits(habits).map((h) => h.id)).toEqual(["b"]);
  });

  it("falls back to all when none active", () => {
    const habits = [
      { id: "a", is_active: false },
      { id: "b", is_active: false },
    ];
    expect(selectEligibleHabits(habits)).toHaveLength(2);
  });
});
