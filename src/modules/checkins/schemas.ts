import { z } from "zod";
import { isoDateSchema, uuidSchema } from "@/lib/validation/common";

export const CHECKIN_PROMPT_SET_KEY = "v1_simple" as const;

export const scoreSchema = z.number().int().min(1).max(5);

const optionalBodySchema = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined));

export const upsertCheckInSchema = z.object({
  checkedOn: isoDateSchema,
  mood: scoreSchema,
  energy: scoreSchema,
  focus: scoreSchema,
  body: optionalBodySchema,
  chapterId: uuidSchema.optional(),
  promptSetKey: z.literal(CHECKIN_PROMPT_SET_KEY).default(CHECKIN_PROMPT_SET_KEY),
});

export const updateCheckInSchema = z.object({
  id: uuidSchema,
  mood: scoreSchema,
  energy: scoreSchema,
  focus: scoreSchema,
  body: optionalBodySchema,
});

export const listCheckInsSchema = z.object({
  fromOn: isoDateSchema.optional(),
  toOn: isoDateSchema.optional(),
  limit: z.number().int().min(1).max(100).default(60),
});

export type UpsertCheckInInput = z.infer<typeof upsertCheckInSchema>;
export type UpdateCheckInInput = z.infer<typeof updateCheckInSchema>;
export type ListCheckInsInput = z.infer<typeof listCheckInsSchema>;
