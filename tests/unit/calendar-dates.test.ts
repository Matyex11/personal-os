import { describe, expect, it } from "vitest";
import {
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
