import { z } from "zod";
import { isoDateSchema, uuidSchema } from "@/lib/validation/common";

/** Canonical keys + units match public.physical_metrics CHECK (M0). */
export const PHYSICAL_METRIC_DEFS = [
  {
    key: "weight_kg",
    unit: "kg",
    label: "Weight",
    kind: "decimal",
    min: 0.1,
    max: 500,
  },
  {
    key: "sleep_hours",
    unit: "hours",
    label: "Sleep",
    kind: "decimal",
    min: 0,
    max: 24,
  },
  {
    key: "steps",
    unit: "count",
    label: "Steps",
    kind: "integer",
    min: 0,
    max: 200_000,
  },
  {
    key: "resting_hr_bpm",
    unit: "bpm",
    label: "Resting heart rate",
    kind: "integer",
    min: 20,
    max: 250,
  },
  {
    key: "workout_minutes",
    unit: "minutes",
    label: "Workout duration",
    kind: "integer",
    min: 0,
    max: 1440,
  },
] as const;

export type PhysicalMetricKey = (typeof PHYSICAL_METRIC_DEFS)[number]["key"];
export type PhysicalMetricUnit = (typeof PHYSICAL_METRIC_DEFS)[number]["unit"];

export const PHYSICAL_METRIC_KEYS = PHYSICAL_METRIC_DEFS.map((d) => d.key) as [
  PhysicalMetricKey,
  ...PhysicalMetricKey[],
];

export const physicalMetricKeySchema = z.enum(PHYSICAL_METRIC_KEYS);

const defByKey = Object.fromEntries(
  PHYSICAL_METRIC_DEFS.map((def) => [def.key, def]),
) as Record<PhysicalMetricKey, (typeof PHYSICAL_METRIC_DEFS)[number]>;

export function physicalMetricDef(key: PhysicalMetricKey) {
  return defByKey[key];
}

export function unitForMetricKey(key: PhysicalMetricKey): PhysicalMetricUnit {
  return defByKey[key].unit;
}

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

/** Per-key value bounds + integer enforcement (mirrors DB CHECK). */
export function valueSchemaForMetric(key: PhysicalMetricKey) {
  const def = defByKey[key];
  if (def.kind === "integer") {
    return z
      .number()
      .refine(isFiniteNumber, "Value must be a finite number")
      .int()
      .min(def.min)
      .max(def.max);
  }
  return z
    .number()
    .refine(isFiniteNumber, "Value must be a finite number")
    .min(def.min)
    .max(def.max);
}

const optionalNotesSchema = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined));

export const upsertPhysicalMetricSchema = z
  .object({
    recordedOn: isoDateSchema,
    metricKey: physicalMetricKeySchema,
    value: z.number().refine(isFiniteNumber, "Value must be a finite number"),
    notes: optionalNotesSchema,
  })
  .superRefine((data, ctx) => {
    const parsed = valueSchemaForMetric(data.metricKey).safeParse(data.value);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        ctx.addIssue({
          code: "custom",
          path: ["value"],
          message: issue.message,
        });
      }
    }
  });

export const upsertPhysicalMetricsForDaySchema = z
  .object({
    recordedOn: isoDateSchema,
    metrics: z
      .array(
        z.object({
          metricKey: physicalMetricKeySchema,
          value: z.number().refine(isFiniteNumber, "Value must be a finite number"),
          notes: optionalNotesSchema,
        }),
      )
      .min(1, "Provide at least one metric value.")
      .max(PHYSICAL_METRIC_KEYS.length),
  })
  .superRefine((data, ctx) => {
    const seen = new Set<string>();
    data.metrics.forEach((entry, index) => {
      if (seen.has(entry.metricKey)) {
        ctx.addIssue({
          code: "custom",
          path: ["metrics", index, "metricKey"],
          message: "Duplicate metric key for this day.",
        });
      }
      seen.add(entry.metricKey);
      const parsed = valueSchemaForMetric(entry.metricKey).safeParse(entry.value);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          ctx.addIssue({
            code: "custom",
            path: ["metrics", index, "value"],
            message: issue.message,
          });
        }
      }
    });
  });

export const updatePhysicalMetricSchema = z
  .object({
    id: uuidSchema,
    metricKey: physicalMetricKeySchema,
    value: z.number().refine(isFiniteNumber, "Value must be a finite number"),
    notes: optionalNotesSchema,
  })
  .superRefine((data, ctx) => {
    const parsed = valueSchemaForMetric(data.metricKey).safeParse(data.value);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        ctx.addIssue({
          code: "custom",
          path: ["value"],
          message: issue.message,
        });
      }
    }
  });

export const listPhysicalMetricsSchema = z.object({
  fromOn: isoDateSchema.optional(),
  toOn: isoDateSchema.optional(),
  metricKey: physicalMetricKeySchema.optional(),
  limit: z.number().int().min(1).max(500).default(200),
});

export type UpsertPhysicalMetricInput = z.infer<typeof upsertPhysicalMetricSchema>;
export type UpsertPhysicalMetricsForDayInput = z.infer<
  typeof upsertPhysicalMetricsForDaySchema
>;
export type UpdatePhysicalMetricInput = z.infer<typeof updatePhysicalMetricSchema>;
export type ListPhysicalMetricsInput = z.infer<typeof listPhysicalMetricsSchema>;
