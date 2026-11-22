import { z } from "zod";
import { isoDateSchema, nonEmptyStringSchema, uuidSchema } from "@/lib/validation/common";
import { habitCadenceSchema } from "@/modules/habits/cadence";

export const habitLogStatusSchema = z.enum([
  "completed",
  "partial",
  "missed",
  "not_scheduled",
  "recovery",
]);

/**
 * Habit create payload. Cadence is required and validated by habitCadenceSchema.
 * Server-only write boundary: createHabit() parses this before any DB insert;
 * the DB also enforces cadence via is_valid_habit_cadence() CHECK.
 */
export const createHabitSchema = z
  .object({
    name: nonEmptyStringSchema,
    description: z.string().trim().max(2000).optional(),
    cadence: habitCadenceSchema,
    minValue: z.number().nonnegative(),
    targetValue: z.number().nonnegative(),
    unit: z.string().trim().max(40).optional(),
    chapterId: uuidSchema.optional(),
  })
  .refine((value) => value.targetValue >= value.minValue, {
    message: "Target must be greater than or equal to minimum",
    path: ["targetValue"],
  });

export const logHabitSchema = z
  .object({
    habitId: uuidSchema,
    loggedOn: isoDateSchema,
    status: habitLogStatusSchema,
    value: z.number().nonnegative().nullable().optional(),
    notes: z.string().trim().max(2000).optional(),
    recoversLogId: uuidSchema.optional(),
  })
  .superRefine((value, ctx) => {
    const isRecovery = value.status === "recovery";
    if (isRecovery && !value.recoversLogId) {
      ctx.addIssue({
        code: "custom",
        message: "Recovery requires recoversLogId",
        path: ["recoversLogId"],
      });
    }
    if (!isRecovery && value.recoversLogId) {
      ctx.addIssue({
        code: "custom",
        message: "recoversLogId is only valid for recovery",
        path: ["recoversLogId"],
      });
    }
  });

export type CreateHabitInput = z.infer<typeof createHabitSchema>;
export type LogHabitInput = z.infer<typeof logHabitSchema>;
