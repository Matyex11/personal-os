import { describe, expect, it } from "vitest";
import { logHabitSchema } from "@/modules/habits/schemas";

describe("logHabitSchema", () => {
  it("accepts a normal completed log", () => {
    const result = logHabitSchema.safeParse({
      habitId: "11111111-1111-4111-8111-111111111111",
      loggedOn: "2026-11-22",
      status: "completed",
      value: 1,
    });
    expect(result.success).toBe(true);
  });

  it("requires recoversLogId for recovery", () => {
    const result = logHabitSchema.safeParse({
      habitId: "11111111-1111-4111-8111-111111111111",
      loggedOn: "2026-11-22",
      status: "recovery",
    });
    expect(result.success).toBe(false);
  });

  it("rejects recoversLogId on non-recovery statuses", () => {
    const result = logHabitSchema.safeParse({
      habitId: "11111111-1111-4111-8111-111111111111",
      loggedOn: "2026-11-22",
      status: "missed",
      recoversLogId: "22222222-2222-4222-8222-222222222222",
    });
    expect(result.success).toBe(false);
  });
});
