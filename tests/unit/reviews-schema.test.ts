import { describe, expect, it } from "vitest";
import {
  completeReviewSchema,
  updateDraftReviewSchema,
  weeklyAnswersSchema,
} from "@/modules/reviews/schemas";

describe("weeklyAnswersSchema", () => {
  it("accepts the four prompt fields within length", () => {
    const result = weeklyAnswersSchema.safeParse({
      wentWell: "shipped M1",
      didNotGoWell: "context switching",
      learned: "seal completed reviews",
      mattersNext: "weekly reviews",
    });
    expect(result.success).toBe(true);
  });

  it("rejects oversized answers", () => {
    expect(
      weeklyAnswersSchema.safeParse({
        wentWell: "x".repeat(2001),
      }).success,
    ).toBe(false);
  });
});

describe("updateDraftReviewSchema", () => {
  it("requires id and normalizes blank answers to omitted", () => {
    const result = updateDraftReviewSchema.safeParse({
      id: "11111111-1111-4111-8111-111111111111",
      answers: {
        wentWell: "  ok  ",
        didNotGoWell: "   ",
        learned: "",
        mattersNext: "next",
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.answers.wentWell).toBe("ok");
      expect(result.data.answers.didNotGoWell).toBeUndefined();
      expect(result.data.answers.learned).toBeUndefined();
      expect(result.data.answers.mattersNext).toBe("next");
    }
  });
});

describe("completeReviewSchema", () => {
  it("requires a uuid id", () => {
    expect(completeReviewSchema.safeParse({ id: "not-a-uuid" }).success).toBe(false);
    expect(
      completeReviewSchema.safeParse({
        id: "11111111-1111-4111-8111-111111111111",
      }).success,
    ).toBe(true);
  });
});
