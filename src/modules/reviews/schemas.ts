import { z } from "zod";
import { isoDateSchema, uuidSchema } from "@/lib/validation/common";

export const REVIEW_PERIOD_KIND_WEEKLY = "weekly" as const;

export const reviewStatusSchema = z.enum(["draft", "completed"]);

/** Four approved weekly prompts — keys match answers JSONB. */
export const weeklyAnswersSchema = z.object({
  wentWell: z.string().trim().max(2000).optional(),
  didNotGoWell: z.string().trim().max(2000).optional(),
  learned: z.string().trim().max(2000).optional(),
  mattersNext: z.string().trim().max(2000).optional(),
});

export type WeeklyAnswers = z.infer<typeof weeklyAnswersSchema>;

export const WEEKLY_ANSWER_FIELDS = [
  {
    key: "wentWell" as const,
    label: "What went well this week?",
  },
  {
    key: "didNotGoWell" as const,
    label: "What did not go well?",
  },
  {
    key: "learned" as const,
    label: "What did I learn?",
  },
  {
    key: "mattersNext" as const,
    label: "What matters most next week?",
  },
] as const;

function emptyToUndefined(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export const updateDraftReviewSchema = z.object({
  id: uuidSchema,
  answers: weeklyAnswersSchema.transform((answers) => ({
    wentWell: emptyToUndefined(answers.wentWell),
    didNotGoWell: emptyToUndefined(answers.didNotGoWell),
    learned: emptyToUndefined(answers.learned),
    mattersNext: emptyToUndefined(answers.mattersNext),
  })),
});

export const completeReviewSchema = z.object({
  id: uuidSchema,
});

export const reopenReviewSchema = z.object({
  id: uuidSchema,
});

export const getOrCreateWeeklyReviewSchema = z.object({
  /** Optional civil day that falls in the desired ISO week; defaults to profile-TZ today. */
  weekOf: isoDateSchema.optional(),
});

export const listReviewsSchema = z.object({
  limit: z.number().int().min(1).max(100).default(52),
});

export type UpdateDraftReviewInput = z.infer<typeof updateDraftReviewSchema>;
export type CompleteReviewInput = z.infer<typeof completeReviewSchema>;
export type ReopenReviewInput = z.infer<typeof reopenReviewSchema>;
