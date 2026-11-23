import { isoDateSchema } from "@/lib/validation/common";

export const DEFAULT_TIME_ZONE = "Europe/Bucharest";

/**
 * Calendar YYYY-MM-DD for `instant` in an IANA time zone.
 * Do not use `toISOString().slice(0, 10)` — that is always UTC.
 */
export function todayInTimeZone(
  timeZone: string,
  instant: Date = new Date(),
): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) {
    throw new Error("Could not resolve calendar date for time zone.");
  }
  return `${year}-${month}-${day}`;
}

/** First calendar day of the month containing `isoDate` (YYYY-MM-DD). */
export function monthStartOn(isoDate: string): string {
  isoDateSchema.parse(isoDate);
  return `${isoDate.slice(0, 8)}01`;
}

/**
 * Inclusive day count between two valid ISO dates (UTC calendar arithmetic).
 * Requires fromOn <= toOn.
 */
export function inclusiveDaySpan(fromOn: string, toOn: string): number {
  isoDateSchema.parse(fromOn);
  isoDateSchema.parse(toOn);
  if (fromOn > toOn) {
    throw new Error("fromOn must be on or before toOn");
  }
  const [fy, fm, fd] = fromOn.split("-").map(Number) as [number, number, number];
  const [ty, tm, td] = toOn.split("-").map(Number) as [number, number, number];
  const fromUtc = Date.UTC(fy, fm - 1, fd);
  const toUtc = Date.UTC(ty, tm - 1, td);
  return Math.floor((toUtc - fromUtc) / 86_400_000) + 1;
}

export function formatPercent(rate: number | null): string {
  if (rate === null) return "N/A";
  return `${Math.round(rate * 100)}%`;
}
