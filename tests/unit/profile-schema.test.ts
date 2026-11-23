import { describe, expect, it } from "vitest";
import {
  DEFAULT_BASE_CURRENCY,
  DISPLAY_NAME_MAX_LENGTH,
  isValidIanaTimeZone,
  isValidIsoCurrency,
  updateProfileSettingsSchema,
} from "@/modules/profile/schemas";
import { DEFAULT_TIME_ZONE } from "@/lib/dates/calendar";

describe("profile settings schema", () => {
  it("accepts a valid full update", () => {
    const result = updateProfileSettingsSchema.safeParse({
      displayName: "  Mátyás  ",
      timezone: "Europe/Bucharest",
      baseCurrency: "ron",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.displayName).toBe("Mátyás");
      expect(result.data.timezone).toBe("Europe/Bucharest");
      expect(result.data.baseCurrency).toBe("RON");
    }
  });

  it("trims empty display names to null", () => {
    const empty = updateProfileSettingsSchema.safeParse({
      displayName: "   ",
      timezone: DEFAULT_TIME_ZONE,
      baseCurrency: DEFAULT_BASE_CURRENCY,
    });
    expect(empty.success).toBe(true);
    if (empty.success) expect(empty.data.displayName).toBeNull();

    const blank = updateProfileSettingsSchema.safeParse({
      displayName: "",
      timezone: DEFAULT_TIME_ZONE,
      baseCurrency: DEFAULT_BASE_CURRENCY,
    });
    expect(blank.success).toBe(true);
    if (blank.success) expect(blank.data.displayName).toBeNull();
  });

  it("rejects oversized display names", () => {
    const result = updateProfileSettingsSchema.safeParse({
      displayName: "x".repeat(DISPLAY_NAME_MAX_LENGTH + 1),
      timezone: DEFAULT_TIME_ZONE,
      baseCurrency: DEFAULT_BASE_CURRENCY,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid IANA timezones", () => {
    expect(isValidIanaTimeZone("Not/A_Zone")).toBe(false);
    expect(isValidIanaTimeZone("Europe/Bucharest")).toBe(true);

    const result = updateProfileSettingsSchema.safeParse({
      displayName: "A",
      timezone: "Fake/Timezone",
      baseCurrency: "RON",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid ISO currencies and rejects arbitrary three-letter codes", () => {
    expect(isValidIsoCurrency("RON")).toBe(true);
    expect(isValidIsoCurrency("USD")).toBe(true);
    expect(isValidIsoCurrency("XYZ")).toBe(false);
    expect(isValidIsoCurrency("ZZZ")).toBe(false);
    expect(isValidIsoCurrency("eu")).toBe(false);

    const badCurrency = updateProfileSettingsSchema.safeParse({
      displayName: "",
      timezone: "UTC",
      baseCurrency: "XYZ",
    });
    expect(badCurrency.success).toBe(false);

    const good = updateProfileSettingsSchema.safeParse({
      displayName: "",
      timezone: "UTC",
      baseCurrency: "EUR",
    });
    expect(good.success).toBe(true);
  });

  it("applies defaults when timezone/currency omitted", () => {
    const result = updateProfileSettingsSchema.safeParse({
      displayName: "Sam",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.timezone).toBe(DEFAULT_TIME_ZONE);
      expect(result.data.baseCurrency).toBe(DEFAULT_BASE_CURRENCY);
    }
  });
});
