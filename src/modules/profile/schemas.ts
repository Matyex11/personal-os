import { z } from "zod";
import { DEFAULT_TIME_ZONE } from "@/lib/dates/calendar";

export const DEFAULT_BASE_CURRENCY = "RON";
export const DISPLAY_NAME_MAX_LENGTH = 100;

let cachedTimeZones: ReadonlySet<string> | null = null;
let cachedCurrencies: ReadonlySet<string> | null = null;

/** IANA zones from the runtime (Node/browser). Cached per process. */
export function listIanaTimeZones(): readonly string[] {
  const zones = new Set(getIanaTimeZoneSet());
  // supportedValuesOf omits UTC on some runtimes; still a valid Intl zone.
  if (isValidIanaTimeZone("UTC")) zones.add("UTC");
  if (isValidIanaTimeZone(DEFAULT_TIME_ZONE)) zones.add(DEFAULT_TIME_ZONE);
  return [...zones].sort((a, b) => a.localeCompare(b));
}

/** ISO 4217 codes actually supported by the runtime. Cached per process. */
export function listIsoCurrencies(): readonly string[] {
  return [...getIsoCurrencySet()].sort((a, b) => a.localeCompare(b));
}

function getIanaTimeZoneSet(): ReadonlySet<string> {
  if (cachedTimeZones) return cachedTimeZones;
  if (typeof Intl.supportedValuesOf === "function") {
    cachedTimeZones = new Set(Intl.supportedValuesOf("timeZone"));
    return cachedTimeZones;
  }
  // Fallback: only prove candidates via DateTimeFormat (no full catalog).
  cachedTimeZones = new Set([DEFAULT_TIME_ZONE, "UTC"]);
  return cachedTimeZones;
}

function getIsoCurrencySet(): ReadonlySet<string> {
  if (cachedCurrencies) return cachedCurrencies;
  if (typeof Intl.supportedValuesOf === "function") {
    cachedCurrencies = new Set(Intl.supportedValuesOf("currency"));
    return cachedCurrencies;
  }
  cachedCurrencies = new Set([DEFAULT_BASE_CURRENCY, "USD", "EUR"]);
  return cachedCurrencies;
}

/**
 * Validates an IANA time zone via the runtime Intl implementation.
 * Prefer DateTimeFormat: catalogs from supportedValuesOf omit some valid
 * identifiers (notably "UTC") that the runtime still accepts.
 */
export function isValidIanaTimeZone(value: string): boolean {
  if (typeof value !== "string" || value.length === 0 || value.length > 128) {
    return false;
  }
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates a real ISO 4217 code (not arbitrary three-letter strings).
 * Prefer Intl.supportedValuesOf("currency"); fall back to NumberFormat.
 */
export function isValidIsoCurrency(value: string): boolean {
  if (typeof value !== "string" || !/^[A-Z]{3}$/.test(value)) return false;
  if (typeof Intl.supportedValuesOf === "function") {
    return getIsoCurrencySet().has(value);
  }
  try {
    new Intl.NumberFormat("en", { style: "currency", currency: value }).format(0);
    return true;
  } catch {
    return false;
  }
}

export const ianaTimeZoneSchema = z
  .string()
  .trim()
  .min(1, "Timezone is required.")
  .refine(isValidIanaTimeZone, {
    message: "Timezone must be a valid IANA time zone identifier.",
  });

export const isoCurrencySchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .pipe(
    z
      .string()
      .regex(/^[A-Z]{3}$/, "Base currency must be a three-letter ISO 4217 code.")
      .refine(isValidIsoCurrency, {
        message: "Base currency must be a supported ISO 4217 currency code.",
      }),
  );

/**
 * Optional display name: trimmed; empty → null; max length enforced.
 */
export const displayNameSchema = z
  .string()
  .trim()
  .max(
    DISPLAY_NAME_MAX_LENGTH,
    `Display name must be at most ${DISPLAY_NAME_MAX_LENGTH} characters.`,
  )
  .transform((value) => (value.length === 0 ? null : value));

export const updateProfileSettingsSchema = z.object({
  displayName: displayNameSchema,
  timezone: ianaTimeZoneSchema.default(DEFAULT_TIME_ZONE),
  baseCurrency: isoCurrencySchema.default(DEFAULT_BASE_CURRENCY),
});

export type UpdateProfileSettingsInput = z.infer<typeof updateProfileSettingsSchema>;
