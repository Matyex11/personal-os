import { describe, expect, it } from "vitest";
import { isoDateSchema } from "@/lib/validation/common";

describe("isoDateSchema", () => {
  it("accepts a real calendar date", () => {
    expect(isoDateSchema.safeParse("2026-11-22").success).toBe(true);
  });

  it("rejects malformed strings", () => {
    expect(isoDateSchema.safeParse("2026/11/22").success).toBe(false);
    expect(isoDateSchema.safeParse("22-11-2026").success).toBe(false);
  });

  it("rejects invalid calendar dates that match YYYY-MM-DD shape", () => {
    expect(isoDateSchema.safeParse("2026-02-31").success).toBe(false);
    expect(isoDateSchema.safeParse("2026-13-01").success).toBe(false);
    expect(isoDateSchema.safeParse("2026-04-31").success).toBe(false);
  });

  it("rejects leap-day on non-leap years", () => {
    expect(isoDateSchema.safeParse("2025-02-29").success).toBe(false);
    expect(isoDateSchema.safeParse("2024-02-29").success).toBe(true);
  });
});
