import { z } from "zod";

export const uuidSchema = z.string().uuid();

export const nonEmptyStringSchema = z.string().trim().min(1).max(500);

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const paginationSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});
