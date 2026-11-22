import { z } from "zod";
import { isoDateSchema, nonEmptyStringSchema, uuidSchema } from "@/lib/validation/common";

export const projectStatusSchema = z.enum(["active", "paused", "done", "dropped"]);
export const milestoneStatusSchema = z.enum(["pending", "hit", "missed", "cancelled"]);
export const taskStatusSchema = z.enum(["todo", "doing", "done", "cancelled"]);

export const createProjectSchema = z.object({
  title: nonEmptyStringSchema,
  description: z.string().trim().max(4000).optional(),
  status: projectStatusSchema.default("active"),
  priority: z.number().int().min(0).max(100).optional(),
  targetDate: isoDateSchema.optional(),
  chapterId: uuidSchema.optional(),
});

export const createMilestoneSchema = z.object({
  title: nonEmptyStringSchema,
  description: z.string().trim().max(2000).optional(),
  projectId: uuidSchema.optional(),
  status: milestoneStatusSchema.default("pending"),
  targetOn: isoDateSchema.optional(),
});

export const createTaskSchema = z.object({
  title: nonEmptyStringSchema,
  notes: z.string().trim().max(4000).optional(),
  projectId: uuidSchema.optional(),
  milestoneId: uuidSchema.optional(),
  status: taskStatusSchema.default("todo"),
  dueOn: isoDateSchema.optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
