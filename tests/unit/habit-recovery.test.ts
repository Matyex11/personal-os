import { describe, expect, it } from "vitest";
import type { HabitLog } from "@/types/domain";
import {
  assertOriginalLogUnchanged,
  buildHabitRecoveryLog,
  validateHabitRecovery,
} from "@/modules/habits/recovery";
import { AppError } from "@/lib/errors";

const originalMissed: HabitLog = {
  id: "22222222-2222-4222-8222-222222222222",
  userId: "11111111-1111-4111-8111-111111111111",
  habitId: "33333333-3333-4333-8333-333333333333",
  loggedOn: "2026-11-20",
  status: "missed",
  value: null,
};

describe("validateHabitRecovery", () => {
  it("accepts recovery of a same-user same-habit missed log", () => {
    const result = validateHabitRecovery(
      {
        userId: originalMissed.userId,
        habitId: originalMissed.habitId,
        recoversLogId: originalMissed.id,
        loggedOn: "2026-11-22",
      },
      originalMissed,
    );
    expect(result).toEqual({ ok: true });
  });

  it("accepts recovery of a partial log", () => {
    const partial = { ...originalMissed, status: "partial" as const, value: 1 };
    const result = validateHabitRecovery(
      {
        userId: partial.userId,
        habitId: partial.habitId,
        recoversLogId: partial.id,
        loggedOn: "2026-11-22",
      },
      partial,
    );
    expect(result.ok).toBe(true);
  });

  it("rejects cross-user recovery", () => {
    const result = validateHabitRecovery(
      {
        userId: "99999999-9999-4999-8999-999999999999",
        habitId: originalMissed.habitId,
        recoversLogId: originalMissed.id,
        loggedOn: "2026-11-22",
      },
      originalMissed,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("forbidden");
  });

  it("rejects cross-habit recovery", () => {
    const result = validateHabitRecovery(
      {
        userId: originalMissed.userId,
        habitId: "44444444-4444-4444-8444-444444444444",
        recoversLogId: originalMissed.id,
        loggedOn: "2026-11-22",
      },
      originalMissed,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("validation");
  });

  it("rejects recovery of completed logs", () => {
    const completed = { ...originalMissed, status: "completed" as const };
    const result = validateHabitRecovery(
      {
        userId: completed.userId,
        habitId: completed.habitId,
        recoversLogId: completed.id,
        loggedOn: "2026-11-22",
      },
      completed,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("conflict");
  });

  it("builds a recovery row without mutating the original", () => {
    const before = structuredClone(originalMissed);
    const recovery = buildHabitRecoveryLog(
      {
        userId: originalMissed.userId,
        habitId: originalMissed.habitId,
        recoversLogId: originalMissed.id,
        loggedOn: "2026-11-22",
        value: 1,
      },
      originalMissed,
      "55555555-5555-4555-8555-555555555555",
    );

    expect(recovery.status).toBe("recovery");
    expect(recovery.recoversLogId).toBe(originalMissed.id);
    assertOriginalLogUnchanged(before, originalMissed);
  });

  it("detects mutation of the original log", () => {
    const after = { ...originalMissed, status: "completed" as const };
    expect(() => assertOriginalLogUnchanged(originalMissed, after)).toThrow(AppError);
  });
});
