import { describe, expect, it } from "vitest";
import { buildTodaysHabitRows } from "@/modules/dashboard/habits-today";

const daily = {
  kind: "daily" as const,
  startOn: "2026-01-01",
};

const weekdaysMonWed = {
  kind: "weekdays" as const,
  weekdays: [1, 3],
  startOn: "2026-01-01",
};

describe("buildTodaysHabitRows", () => {
  const todayOn = "2026-11-23"; // Monday
  const timeZone = "Europe/Bucharest";

  it("marks scheduled unlogged when no primary log", () => {
    const rows = buildTodaysHabitRows({
      habits: [{ id: "h1", name: "Run", is_active: true, cadence: daily }],
      logs: [],
      todayOn,
      timeZone,
    });
    expect(rows).toEqual([
      {
        habitId: "h1",
        name: "Run",
        outcome: "unlogged",
        recoveryLoggedToday: false,
        scheduledToday: true,
      },
    ]);
  });

  it("surfaces primary statuses and ignores inactive habits", () => {
    const rows = buildTodaysHabitRows({
      habits: [
        { id: "h1", name: "A", is_active: true, cadence: daily },
        { id: "h2", name: "B", is_active: true, cadence: daily },
        { id: "h3", name: "C", is_active: true, cadence: daily },
        { id: "h4", name: "Off", is_active: false, cadence: daily },
      ],
      logs: [
        { habitId: "h1", loggedOn: todayOn, status: "completed" },
        { habitId: "h2", loggedOn: todayOn, status: "partial" },
        { habitId: "h3", loggedOn: todayOn, status: "missed" },
      ],
      todayOn,
      timeZone,
    });
    expect(rows.map((r) => [r.habitId, r.outcome])).toEqual([
      ["h1", "completed"],
      ["h2", "partial"],
      ["h3", "missed"],
    ]);
  });

  it("marks unscheduled weekdays as not_scheduled", () => {
    // 2026-11-24 is Tuesday — not Mon/Wed
    const rows = buildTodaysHabitRows({
      habits: [
        { id: "h1", name: "Gym", is_active: true, cadence: weekdaysMonWed },
      ],
      logs: [],
      todayOn: "2026-11-24",
      timeZone,
    });
    expect(rows[0]?.outcome).toBe("not_scheduled");
    expect(rows[0]?.scheduledToday).toBe(false);
  });

  it("does not let recovery replace primary; annotates recovery on the day", () => {
    const rows = buildTodaysHabitRows({
      habits: [{ id: "h1", name: "Run", is_active: true, cadence: daily }],
      logs: [
        { habitId: "h1", loggedOn: todayOn, status: "missed" },
        { habitId: "h1", loggedOn: todayOn, status: "recovery" },
      ],
      todayOn,
      timeZone,
    });
    expect(rows[0]?.outcome).toBe("missed");
    expect(rows[0]?.recoveryLoggedToday).toBe(true);
  });

  it("treats recovery-only on a scheduled day as unlogged with recovery annotation", () => {
    const rows = buildTodaysHabitRows({
      habits: [{ id: "h1", name: "Run", is_active: true, cadence: daily }],
      logs: [{ habitId: "h1", loggedOn: todayOn, status: "recovery" }],
      todayOn,
      timeZone,
    });
    expect(rows[0]?.outcome).toBe("unlogged");
    expect(rows[0]?.recoveryLoggedToday).toBe(true);
  });

  it("treats explicit not_scheduled primary as not_scheduled", () => {
    const rows = buildTodaysHabitRows({
      habits: [{ id: "h1", name: "Run", is_active: true, cadence: daily }],
      logs: [{ habitId: "h1", loggedOn: todayOn, status: "not_scheduled" }],
      todayOn,
      timeZone,
    });
    expect(rows[0]?.outcome).toBe("not_scheduled");
  });
});
