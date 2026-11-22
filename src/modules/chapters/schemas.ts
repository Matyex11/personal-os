import { z } from "zod";
import { isoDateSchema, nonEmptyStringSchema } from "@/lib/validation/common";

export const chapterStatusSchema = z.enum(["planned", "active", "closed"]);

export const createChapterSchema = z
  .object({
    title: nonEmptyStringSchema,
    summary: z.string().trim().max(4000).optional(),
    status: chapterStatusSchema.default("planned"),
    startedOn: isoDateSchema,
    endedOn: isoDateSchema.optional(),
    isCurrent: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    if (value.isCurrent && value.status !== "active") {
      ctx.addIssue({
        code: "custom",
        message: "Current chapter must be active",
        path: ["status"],
      });
    }

    if (value.status === "planned" && value.endedOn) {
      ctx.addIssue({
        code: "custom",
        message: "Planned chapter cannot have endedOn",
        path: ["endedOn"],
      });
    }

    if (value.status === "active" && value.endedOn) {
      ctx.addIssue({
        code: "custom",
        message: "Active chapter cannot have endedOn",
        path: ["endedOn"],
      });
    }

    if (value.status === "closed" && !value.endedOn) {
      ctx.addIssue({
        code: "custom",
        message: "Closed chapter requires endedOn",
        path: ["endedOn"],
      });
    }

    if (value.endedOn && value.endedOn < value.startedOn) {
      ctx.addIssue({
        code: "custom",
        message: "endedOn must be on or after startedOn",
        path: ["endedOn"],
      });
    }
  });

export type CreateChapterInput = z.infer<typeof createChapterSchema>;
