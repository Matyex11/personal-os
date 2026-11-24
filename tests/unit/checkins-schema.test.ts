import { describe, expect, it } from "vitest";
import {
  CHECKIN_PROMPT_SET_KEY,
  listCheckInsSchema,
  scoreSchema,
  updateCheckInSchema,
  upsertCheckInSchema,
} from "@/modules/checkins/schemas";

describe("scoreSchema", () => {
  it("accepts integers 1–5 only", () => {
    expect(scoreSchema.safeParse(1).success).toBe(true);
    expect(scoreSchema.safeParse(5).success).toBe(true);
    expect(scoreSchema.safeParse(0).success).toBe(false);
    expect(scoreSchema.safeParse(6).success).toBe(false);
    expect(scoreSchema.safeParse(3.5).success).toBe(false);
  });
});

describe("upsertCheckInSchema", () => {
  it("accepts a valid check-in and defaults prompt set", () => {
    const result = upsertCheckInSchema.safeParse({
      checkedOn: "2026-11-24",
      mood: 4,
      energy: 3,
      focus: 5,
      body: "  steady day  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.promptSetKey).toBe(CHECKIN_PROMPT_SET_KEY);
      expect(result.data.body).toBe("steady day");
    }
  });

  it("rejects out-of-range scores and oversized body", () => {
    expect(
      upsertCheckInSchema.safeParse({
        checkedOn: "2026-11-24",
        mood: 0,
        energy: 3,
        focus: 3,
      }).success,
    ).toBe(false);

    expect(
      upsertCheckInSchema.safeParse({
        checkedOn: "2026-11-24",
        mood: 3,
        energy: 3,
        focus: 3,
        body: "x".repeat(2001),
      }).success,
    ).toBe(false);
  });

  it("rejects non-v1_simple prompt keys", () => {
    expect(
      upsertCheckInSchema.safeParse({
        checkedOn: "2026-11-24",
        mood: 3,
        energy: 3,
        focus: 3,
        promptSetKey: "v2",
      }).success,
    ).toBe(false);
  });

  it("treats blank body as omitted", () => {
    const result = upsertCheckInSchema.safeParse({
      checkedOn: "2026-11-24",
      mood: 2,
      energy: 2,
      focus: 2,
      body: "   ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.body).toBeUndefined();
    }
  });
});

describe("updateCheckInSchema", () => {
  it("requires id and score bounds", () => {
    expect(
      updateCheckInSchema.safeParse({
        id: "11111111-1111-4111-8111-111111111111",
        mood: 1,
        energy: 2,
        focus: 3,
      }).success,
    ).toBe(true);

    expect(
      updateCheckInSchema.safeParse({
        mood: 1,
        energy: 2,
        focus: 3,
      }).success,
    ).toBe(false);
  });
});

describe("listCheckInsSchema", () => {
  it("defaults limit and accepts optional range", () => {
    const empty = listCheckInsSchema.safeParse({});
    expect(empty.success).toBe(true);
    if (empty.success) expect(empty.data.limit).toBe(60);

    expect(
      listCheckInsSchema.safeParse({
        fromOn: "2026-11-01",
        toOn: "2026-11-24",
        limit: 10,
      }).success,
    ).toBe(true);
  });
});
