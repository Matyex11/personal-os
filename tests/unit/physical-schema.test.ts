import { describe, expect, it } from "vitest";
import {
  listPhysicalMetricsSchema,
  PHYSICAL_METRIC_KEYS,
  updatePhysicalMetricSchema,
  upsertPhysicalMetricSchema,
  upsertPhysicalMetricsForDaySchema,
  valueSchemaForMetric,
} from "@/modules/physical/schemas";

describe("valueSchemaForMetric", () => {
  it("enforces weight decimal bounds", () => {
    expect(valueSchemaForMetric("weight_kg").safeParse(72.5).success).toBe(true);
    expect(valueSchemaForMetric("weight_kg").safeParse(0.05).success).toBe(false);
    expect(valueSchemaForMetric("weight_kg").safeParse(501).success).toBe(false);
    expect(valueSchemaForMetric("weight_kg").safeParse(Number.NaN).success).toBe(false);
  });

  it("requires integers for steps / hr / workout", () => {
    expect(valueSchemaForMetric("steps").safeParse(8000).success).toBe(true);
    expect(valueSchemaForMetric("steps").safeParse(8000.5).success).toBe(false);
    expect(valueSchemaForMetric("resting_hr_bpm").safeParse(19).success).toBe(false);
    expect(valueSchemaForMetric("workout_minutes").safeParse(1441).success).toBe(false);
  });
});

describe("upsertPhysicalMetricSchema", () => {
  it("accepts a valid metric and rejects unit mismatches via key bounds", () => {
    const ok = upsertPhysicalMetricSchema.safeParse({
      recordedOn: "2026-11-24",
      metricKey: "sleep_hours",
      value: 7.5,
      notes: "  restful  ",
    });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.notes).toBe("restful");

    expect(
      upsertPhysicalMetricSchema.safeParse({
        recordedOn: "2026-11-24",
        metricKey: "weight_kg",
        value: 0,
      }).success,
    ).toBe(false);
  });

  it("rejects unknown metric keys", () => {
    expect(
      upsertPhysicalMetricSchema.safeParse({
        recordedOn: "2026-11-24",
        metricKey: "resting_heart_rate",
        value: 60,
      }).success,
    ).toBe(false);
  });
});

describe("upsertPhysicalMetricsForDaySchema", () => {
  it("requires at least one metric and rejects duplicates", () => {
    expect(
      upsertPhysicalMetricsForDaySchema.safeParse({
        recordedOn: "2026-11-24",
        metrics: [],
      }).success,
    ).toBe(false);

    expect(
      upsertPhysicalMetricsForDaySchema.safeParse({
        recordedOn: "2026-11-24",
        metrics: [
          { metricKey: "steps", value: 1000 },
          { metricKey: "steps", value: 2000 },
        ],
      }).success,
    ).toBe(false);

    expect(
      upsertPhysicalMetricsForDaySchema.safeParse({
        recordedOn: "2026-11-24",
        metrics: [
          { metricKey: "weight_kg", value: 70 },
          { metricKey: "steps", value: 5000 },
        ],
      }).success,
    ).toBe(true);
  });

  it("allows a subset of the five approved keys", () => {
    expect(PHYSICAL_METRIC_KEYS).toHaveLength(5);
    const result = upsertPhysicalMetricsForDaySchema.safeParse({
      recordedOn: "2026-11-24",
      metrics: [{ metricKey: "workout_minutes", value: 45 }],
    });
    expect(result.success).toBe(true);
  });
});

describe("updatePhysicalMetricSchema", () => {
  it("requires id and per-key bounds", () => {
    expect(
      updatePhysicalMetricSchema.safeParse({
        id: "11111111-1111-4111-8111-111111111111",
        metricKey: "resting_hr_bpm",
        value: 58,
      }).success,
    ).toBe(true);

    expect(
      updatePhysicalMetricSchema.safeParse({
        metricKey: "resting_hr_bpm",
        value: 58,
      }).success,
    ).toBe(false);
  });
});

describe("listPhysicalMetricsSchema", () => {
  it("defaults limit and accepts filters", () => {
    const empty = listPhysicalMetricsSchema.safeParse({});
    expect(empty.success).toBe(true);
    if (empty.success) expect(empty.data.limit).toBe(200);

    expect(
      listPhysicalMetricsSchema.safeParse({
        fromOn: "2026-11-01",
        toOn: "2026-11-24",
        metricKey: "weight_kg",
        limit: 20,
      }).success,
    ).toBe(true);
  });
});
