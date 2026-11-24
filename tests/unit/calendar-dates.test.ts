import { describe, expect, it } from "vitest";
import {
  addCalendarDays,
  inclusiveDaySpan,
  monthStartOn,
  todayInTimeZone,
} from "@/lib/dates/calendar";

describe("todayInTimeZone", () => {
  it("returns the Bucharest calendar date near a UTC midnight boundary", () => {
    // 2026-06-15 22:30 UTC = 2026-06-16 01:30 in Europe/Bucharest (UTC+3 summer)
    const instant = new Date("2026-06-15T22:30:00.000Z");
    expect(todayInTimeZone("Europe/Bucharest", instant)).toBe("2026-06-16");
    // UTC slice would still say the 15th — proving we must not use toISOString.
    expect(instant.toISOString().slice(0, 10)).toBe("2026-06-15");
  });

  it("returns the prior calendar day in US Pacific when UTC is already next day", () => {
    // 2026-01-10 05:00 UTC = 2026-01-09 21:00 America/Los_Angeles (UTC-8)
    const instant = new Date("2026-01-10T05:00:00.000Z");
    expect(todayInTimeZone("America/Los_Angeles", instant)).toBe("2026-01-09");
    expect(instant.toISOString().slice(0, 10)).toBe("2026-01-10");
  });

  it("handles Europe/Bucharest spring DST transition civil dates (2026-03-29)", () => {
    // EU spring forward at 01:00 UTC. Bucharest: EET (UTC+2) → EEST (UTC+3).
    // Civil midnight boundary remains continuous via Intl — no UTC slice.
    const beforeLocalMidnight = new Date("2026-03-28T21:30:00.000Z"); // 23:30 EET Mar 28
    const afterLocalMidnight = new Date("2026-03-28T22:30:00.000Z"); // 00:30 EET Mar 29
    const afterSpringForward = new Date("2026-03-29T01:30:00.000Z"); // 04:30 EEST Mar 29
    expect(todayInTimeZone("Europe/Bucharest", beforeLocalMidnight)).toBe("2026-03-28");
    expect(todayInTimeZone("Europe/Bucharest", afterLocalMidnight)).toBe("2026-03-29");
    expect(todayInTimeZone("Europe/Bucharest", afterSpringForward)).toBe("2026-03-29");
    expect(beforeLocalMidnight.toISOString().slice(0, 10)).toBe("2026-03-28");
    expect(afterLocalMidnight.toISOString().slice(0, 10)).toBe("2026-03-28"); // UTC still 28th
  });

  it("handles Europe/Bucharest autumn DST transition civil dates (2026-10-25)", () => {
    // EU fall back at 01:00 UTC. Bucharest: EEST (UTC+3) → EET (UTC+2).
    const beforeLocalMidnight = new Date("2026-10-24T20:30:00.000Z"); // 23:30 EEST Oct 24
    const afterLocalMidnight = new Date("2026-10-24T21:30:00.000Z"); // 00:30 EEST Oct 25
    const afterFallBack = new Date("2026-10-25T01:30:00.000Z"); // 03:30 EET Oct 25
    expect(todayInTimeZone("Europe/Bucharest", beforeLocalMidnight)).toBe("2026-10-24");
    expect(todayInTimeZone("Europe/Bucharest", afterLocalMidnight)).toBe("2026-10-25");
    expect(todayInTimeZone("Europe/Bucharest", afterFallBack)).toBe("2026-10-25");
    expect(afterLocalMidnight.toISOString().slice(0, 10)).toBe("2026-10-24"); // UTC still 24th
  });
});

describe("civil date preservation helpers", () => {
  it("preserves historical YYYY-MM-DD under addCalendarDays (date-only arithmetic)", () => {
    expect(addCalendarDays("2026-03-28", 1)).toBe("2026-03-29");
    expect(addCalendarDays("2026-10-25", -1)).toBe("2026-10-24");
    expect(addCalendarDays("2026-11-20", 0)).toBe("2026-11-20");
  });
});

describe("monthStartOn", () => {
  it("returns the first day of the month", () => {
    expect(monthStartOn("2026-11-22")).toBe("2026-11-01");
  });
});

describe("inclusiveDaySpan", () => {
  it("counts inclusive calendar days", () => {
    expect(inclusiveDaySpan("2026-01-01", "2026-01-01")).toBe(1);
    expect(inclusiveDaySpan("2026-01-01", "2026-01-02")).toBe(2);
    expect(inclusiveDaySpan("2026-01-01", "2026-12-31")).toBe(365);
  });

  it("supports leap-year 366-day windows", () => {
    expect(inclusiveDaySpan("2024-01-01", "2024-12-31")).toBe(366);
  });
});

describe("addCalendarDays", () => {
  it("adds calendar days across month boundaries", () => {
    expect(addCalendarDays("2026-11-23", 7)).toBe("2026-11-30");
    expect(addCalendarDays("2026-11-23", -3)).toBe("2026-11-20");
    expect(addCalendarDays("2026-01-31", 1)).toBe("2026-02-01");
  });
});
