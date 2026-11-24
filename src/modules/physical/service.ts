import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { DEFAULT_TIME_ZONE, todayInTimeZone } from "@/lib/dates/calendar";
import type { PhysicalMetricRow, ProfileRow } from "@/lib/db/types";
import { AppError, toUserMessage } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { isoDateSchema } from "@/lib/validation/common";
import {
  listPhysicalMetricsSchema,
  PHYSICAL_METRIC_KEYS,
  type PhysicalMetricKey,
  unitForMetricKey,
  updatePhysicalMetricSchema,
  upsertPhysicalMetricSchema,
  upsertPhysicalMetricsForDaySchema,
} from "@/modules/physical/schemas";
import { getProfileTimeZone } from "@/modules/habits/service";

function firstZodIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input.";
}

/** Postgres unique_violation — concurrent same-day same-key insert races. */
function isUniqueViolation(error: { code?: string } | null | undefined): boolean {
  return error?.code === "23505";
}

type MetricWriteFields = {
  value: number;
  unit: string;
  notes: string | null;
  /** When true, omit notes from update payload (preserve existing). */
  preserveNotes: boolean;
};

async function updateOwnedMetricById(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  id: string,
  fields: MetricWriteFields,
  updatedAt: string,
): Promise<PhysicalMetricRow> {
  const payload: Record<string, unknown> = {
    value: fields.value,
    unit: fields.unit,
    updated_at: updatedAt,
  };
  if (!fields.preserveNotes) {
    payload.notes = fields.notes;
  }

  const updated = await supabase
    .from("physical_metrics")
    .update(payload)
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (updated.error || !updated.data) {
    throw new AppError("unavailable", "Could not update physical metric.");
  }
  return updated.data as PhysicalMetricRow;
}

/**
 * Single recovery after insert unique conflict: reselect by
 * (user_id, metric_key, recorded_on), then update once. Never loops.
 */
async function recoverFromConcurrentInsert(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  recordedOn: string,
  metricKey: PhysicalMetricKey,
  fields: MetricWriteFields,
  updatedAt: string,
): Promise<PhysicalMetricRow> {
  const winner = await supabase
    .from("physical_metrics")
    .select("id")
    .eq("user_id", userId)
    .eq("metric_key", metricKey)
    .eq("recorded_on", recordedOn)
    .maybeSingle();
  if (winner.error) {
    throw new AppError("unavailable", "Could not recover physical metric after conflict.");
  }
  if (!winner.data?.id) {
    throw new AppError(
      "conflict",
      "A measurement for that metric and day already exists, but could not be loaded.",
    );
  }
  return updateOwnedMetricById(supabase, userId, winner.data.id, fields, updatedAt);
}

async function upsertOneMetric(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  recordedOn: string,
  metricKey: PhysicalMetricKey,
  value: number,
  notes: string | undefined,
): Promise<PhysicalMetricRow> {
  const now = new Date().toISOString();
  const unit = unitForMetricKey(metricKey);
  const fields: MetricWriteFields = {
    value,
    unit,
    notes: notes ?? null,
    preserveNotes: notes === undefined,
  };

  const existing = await supabase
    .from("physical_metrics")
    .select("id")
    .eq("user_id", userId)
    .eq("metric_key", metricKey)
    .eq("recorded_on", recordedOn)
    .maybeSingle();
  if (existing.error) {
    throw new AppError("unavailable", "Could not save physical metric.");
  }

  if (existing.data?.id) {
    return updateOwnedMetricById(supabase, userId, existing.data.id, fields, now);
  }

  const inserted = await supabase
    .from("physical_metrics")
    .insert({
      user_id: userId,
      recorded_on: recordedOn,
      metric_key: metricKey,
      value,
      unit,
      notes: notes ?? null,
      updated_at: now,
    })
    .select("*")
    .single();

  if (inserted.error) {
    if (isUniqueViolation(inserted.error)) {
      return recoverFromConcurrentInsert(
        supabase,
        userId,
        recordedOn,
        metricKey,
        { ...fields, preserveNotes: false, notes: notes ?? null },
        now,
      );
    }
    throw new AppError("unavailable", "Could not save physical metric.");
  }
  return inserted.data as PhysicalMetricRow;
}

export async function listPhysicalMetrics(input: unknown = {}) {
  try {
    const user = await requireUser();
    let parsed: z.infer<typeof listPhysicalMetricsSchema>;
    try {
      parsed = listPhysicalMetricsSchema.parse(input ?? {});
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AppError("validation", firstZodIssueMessage(error));
      }
      throw error;
    }

    if (parsed.fromOn && parsed.toOn && parsed.fromOn > parsed.toOn) {
      throw new AppError("validation", "fromOn must be on or before toOn.");
    }

    const supabase = await createClient();
    let query = supabase
      .from("physical_metrics")
      .select("*")
      .eq("user_id", user.id)
      .order("recorded_on", { ascending: false })
      .order("metric_key", { ascending: true })
      .limit(parsed.limit);

    if (parsed.fromOn) query = query.gte("recorded_on", parsed.fromOn);
    if (parsed.toOn) query = query.lte("recorded_on", parsed.toOn);
    if (parsed.metricKey) query = query.eq("metric_key", parsed.metricKey);

    const { data, error } = await query;
    if (error) throw new AppError("unavailable", "Could not load physical metrics.");
    return { ok: true as const, data: (data ?? []) as PhysicalMetricRow[] };
  } catch (error) {
    return { ok: false as const, message: toUserMessage(error) };
  }
}

export async function getPhysicalMetricsForDay(recordedOn: string) {
  try {
    const user = await requireUser();
    let parsedOn: string;
    try {
      parsedOn = isoDateSchema.parse(recordedOn);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AppError("validation", firstZodIssueMessage(error));
      }
      throw error;
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("physical_metrics")
      .select("*")
      .eq("user_id", user.id)
      .eq("recorded_on", parsedOn)
      .order("metric_key", { ascending: true });
    if (error) throw new AppError("unavailable", "Could not load physical metrics.");
    return { ok: true as const, data: (data ?? []) as PhysicalMetricRow[] };
  } catch (error) {
    return { ok: false as const, message: toUserMessage(error) };
  }
}

/**
 * Upsert one metric for a civil day. Prefer select→update/insert.
 * On concurrent insert race (23505): one reselect+update — never loops. No DELETE.
 */
export async function upsertPhysicalMetric(input: unknown) {
  try {
    const user = await requireUser();
    let parsed: z.infer<typeof upsertPhysicalMetricSchema>;
    try {
      parsed = upsertPhysicalMetricSchema.parse(input);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AppError("validation", firstZodIssueMessage(error));
      }
      throw error;
    }

    const supabase = await createClient();
    const data = await upsertOneMetric(
      supabase,
      user.id,
      parsed.recordedOn,
      parsed.metricKey,
      parsed.value,
      parsed.notes,
    );
    return { ok: true as const, data };
  } catch (error) {
    return { ok: false as const, message: toUserMessage(error) };
  }
}

/**
 * Upsert a subset of metrics for one civil day. Empty fields are omitted by the caller.
 * Validates the whole batch first; stops on first write failure.
 */
export async function upsertPhysicalMetricsForDay(input: unknown) {
  try {
    const user = await requireUser();
    let parsed: z.infer<typeof upsertPhysicalMetricsForDaySchema>;
    try {
      parsed = upsertPhysicalMetricsForDaySchema.parse(input);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AppError("validation", firstZodIssueMessage(error));
      }
      throw error;
    }

    const supabase = await createClient();
    const rows: PhysicalMetricRow[] = [];
    for (const entry of parsed.metrics) {
      const row = await upsertOneMetric(
        supabase,
        user.id,
        parsed.recordedOn,
        entry.metricKey,
        entry.value,
        entry.notes,
      );
      rows.push(row);
    }
    return { ok: true as const, data: rows };
  } catch (error) {
    return { ok: false as const, message: toUserMessage(error) };
  }
}

/** Update value/notes on an owned row. Day and metric_key are immutable. */
export async function updatePhysicalMetric(input: unknown) {
  try {
    const user = await requireUser();
    let parsed: z.infer<typeof updatePhysicalMetricSchema>;
    try {
      parsed = updatePhysicalMetricSchema.parse(input);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AppError("validation", firstZodIssueMessage(error));
      }
      throw error;
    }

    const supabase = await createClient();
    const payload: Record<string, unknown> = {
      value: parsed.value,
      unit: unitForMetricKey(parsed.metricKey),
      updated_at: new Date().toISOString(),
    };
    if (parsed.notes !== undefined) {
      payload.notes = parsed.notes;
    }

    const { data, error } = await supabase
      .from("physical_metrics")
      .update(payload)
      .eq("id", parsed.id)
      .eq("user_id", user.id)
      .eq("metric_key", parsed.metricKey)
      .select("*")
      .maybeSingle();

    if (error) throw new AppError("unavailable", "Could not update physical metric.");
    if (!data) throw new AppError("not_found", "Physical metric not found.");
    return { ok: true as const, data: data as PhysicalMetricRow };
  } catch (error) {
    return { ok: false as const, message: toUserMessage(error) };
  }
}

/** Latest value per approved metric key for the dashboard snapshot. */
export async function getLatestPhysicalSnapshot() {
  try {
    const user = await requireUser();
    const supabase = await createClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("timezone")
      .eq("id", user.id)
      .maybeSingle();
    const timeZone = (profile as ProfileRow | null)?.timezone ?? DEFAULT_TIME_ZONE;
    const todayOn = todayInTimeZone(timeZone);

    const { data, error } = await supabase
      .from("physical_metrics")
      .select("*")
      .eq("user_id", user.id)
      .in("metric_key", [...PHYSICAL_METRIC_KEYS])
      .order("recorded_on", { ascending: false })
      .limit(100);
    if (error) throw new AppError("unavailable", "Could not load physical metrics.");

    const rows = (data ?? []) as PhysicalMetricRow[];
    const latestByKey = {} as Record<PhysicalMetricKey, PhysicalMetricRow | null>;
    for (const key of PHYSICAL_METRIC_KEYS) {
      latestByKey[key] = null;
    }
    for (const row of rows) {
      const key = row.metric_key as PhysicalMetricKey;
      if (!(key in latestByKey)) continue;
      if (!latestByKey[key]) {
        latestByKey[key] = row;
      }
    }

    const todayRows = rows.filter((row) => row.recorded_on === todayOn);

    return {
      ok: true as const,
      data: {
        todayOn,
        timeZone,
        todayCount: todayRows.length,
        latestByKey,
      },
    };
  } catch (error) {
    return { ok: false as const, message: toUserMessage(error) };
  }
}

export { getProfileTimeZone };
