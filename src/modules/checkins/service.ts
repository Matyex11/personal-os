import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { DEFAULT_TIME_ZONE, todayInTimeZone } from "@/lib/dates/calendar";
import type { CheckInRow, ProfileRow } from "@/lib/db/types";
import { AppError, toUserMessage } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { isoDateSchema } from "@/lib/validation/common";
import {
  listCheckInsSchema,
  updateCheckInSchema,
  upsertCheckInSchema,
} from "@/modules/checkins/schemas";
import { getProfileTimeZone } from "@/modules/habits/service";

function firstZodIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input.";
}

/** Postgres unique_violation — used for concurrent same-day insert races. */
function isUniqueViolation(error: { code?: string } | null | undefined): boolean {
  return error?.code === "23505";
}

type CheckInWriteFields = {
  mood: number;
  energy: number;
  focus: number;
  body: string | null;
  chapterId: string | null;
  promptSetKey: string;
};

async function updateOwnedCheckInById(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  id: string,
  fields: CheckInWriteFields,
  updatedAt: string,
): Promise<CheckInRow> {
  const updated = await supabase
    .from("check_ins")
    .update({
      mood: fields.mood,
      energy: fields.energy,
      focus: fields.focus,
      body: fields.body,
      chapter_id: fields.chapterId,
      prompt_set_key: fields.promptSetKey,
      updated_at: updatedAt,
    })
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (updated.error || !updated.data) {
    throw new AppError("unavailable", "Could not update check-in.");
  }
  return updated.data as CheckInRow;
}

/**
 * Single recovery after insert unique conflict: reselect by (user_id, checked_on),
 * then update once. Never loops.
 */
async function recoverFromConcurrentInsert(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  checkedOn: string,
  fields: CheckInWriteFields,
  updatedAt: string,
): Promise<CheckInRow> {
  const winner = await supabase
    .from("check_ins")
    .select("id")
    .eq("user_id", userId)
    .eq("checked_on", checkedOn)
    .maybeSingle();
  if (winner.error) {
    throw new AppError("unavailable", "Could not recover check-in after conflict.");
  }
  if (!winner.data?.id) {
    throw new AppError(
      "conflict",
      "A check-in for that day already exists, but could not be loaded.",
    );
  }
  return updateOwnedCheckInById(supabase, userId, winner.data.id, fields, updatedAt);
}

export async function listCheckIns(input: unknown = {}) {
  try {
    const user = await requireUser();
    let parsed: z.infer<typeof listCheckInsSchema>;
    try {
      parsed = listCheckInsSchema.parse(input ?? {});
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
      .from("check_ins")
      .select("*")
      .eq("user_id", user.id)
      .order("checked_on", { ascending: false })
      .limit(parsed.limit);

    if (parsed.fromOn) query = query.gte("checked_on", parsed.fromOn);
    if (parsed.toOn) query = query.lte("checked_on", parsed.toOn);

    const { data, error } = await query;
    if (error) throw new AppError("unavailable", "Could not load check-ins.");
    return { ok: true as const, data: (data ?? []) as CheckInRow[] };
  } catch (error) {
    return { ok: false as const, message: toUserMessage(error) };
  }
}

export async function getCheckInForDay(checkedOn: string) {
  try {
    const user = await requireUser();
    let parsedOn: string;
    try {
      parsedOn = isoDateSchema.parse(checkedOn);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AppError("validation", firstZodIssueMessage(error));
      }
      throw error;
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("check_ins")
      .select("*")
      .eq("user_id", user.id)
      .eq("checked_on", parsedOn)
      .maybeSingle();
    if (error) throw new AppError("unavailable", "Could not load check-in.");
    return { ok: true as const, data: (data as CheckInRow | null) ?? null };
  } catch (error) {
    return { ok: false as const, message: toUserMessage(error) };
  }
}

/**
 * One check-in per civil day: update existing (user_id, checked_on) or insert.
 * Prefer explicit select→update/insert over PostgREST upsert (clearer RLS path).
 * On concurrent insert race (Postgres 23505): one reselect+update recovery — never loops.
 * No DELETE path.
 */
export async function upsertCheckIn(input: unknown) {
  try {
    const user = await requireUser();
    let parsed: z.infer<typeof upsertCheckInSchema>;
    try {
      parsed = upsertCheckInSchema.parse(input);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AppError("validation", firstZodIssueMessage(error));
      }
      throw error;
    }

    const supabase = await createClient();
    const now = new Date().toISOString();
    const fields: CheckInWriteFields = {
      mood: parsed.mood,
      energy: parsed.energy,
      focus: parsed.focus,
      body: parsed.body ?? null,
      chapterId: parsed.chapterId ?? null,
      promptSetKey: parsed.promptSetKey,
    };

    const existing = await supabase
      .from("check_ins")
      .select("id")
      .eq("user_id", user.id)
      .eq("checked_on", parsed.checkedOn)
      .maybeSingle();
    if (existing.error) throw new AppError("unavailable", "Could not save check-in.");

    if (existing.data?.id) {
      const data = await updateOwnedCheckInById(
        supabase,
        user.id,
        existing.data.id,
        fields,
        now,
      );
      return { ok: true as const, data };
    }

    const inserted = await supabase
      .from("check_ins")
      .insert({
        user_id: user.id,
        chapter_id: fields.chapterId,
        checked_on: parsed.checkedOn,
        mood: fields.mood,
        energy: fields.energy,
        focus: fields.focus,
        body: fields.body,
        prompt_set_key: fields.promptSetKey,
        updated_at: now,
      })
      .select("*")
      .single();

    if (inserted.error) {
      if (isUniqueViolation(inserted.error)) {
        const data = await recoverFromConcurrentInsert(
          supabase,
          user.id,
          parsed.checkedOn,
          fields,
          now,
        );
        return { ok: true as const, data };
      }
      throw new AppError("unavailable", "Could not save check-in.");
    }
    return { ok: true as const, data: inserted.data as CheckInRow };
  } catch (error) {
    return { ok: false as const, message: toUserMessage(error) };
  }
}

/** Update scores/body on an owned row (historical edits allowed). Day is immutable. */
export async function updateCheckIn(input: unknown) {
  try {
    const user = await requireUser();
    let parsed: z.infer<typeof updateCheckInSchema>;
    try {
      parsed = updateCheckInSchema.parse(input);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AppError("validation", firstZodIssueMessage(error));
      }
      throw error;
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("check_ins")
      .update({
        mood: parsed.mood,
        energy: parsed.energy,
        focus: parsed.focus,
        body: parsed.body ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", parsed.id)
      .eq("user_id", user.id)
      .select("*")
      .maybeSingle();

    if (error) throw new AppError("unavailable", "Could not update check-in.");
    if (!data) throw new AppError("not_found", "Check-in not found.");
    return { ok: true as const, data: data as CheckInRow };
  } catch (error) {
    return { ok: false as const, message: toUserMessage(error) };
  }
}

/** Profile-TZ today check-in status for the dashboard. */
export async function getTodaysCheckInStatus() {
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
      .from("check_ins")
      .select("id, checked_on, mood, energy, focus, body, prompt_set_key")
      .eq("user_id", user.id)
      .eq("checked_on", todayOn)
      .maybeSingle();
    if (error) throw new AppError("unavailable", "Could not load today's check-in.");

    return {
      ok: true as const,
      data: {
        todayOn,
        timeZone,
        checkIn: (data as Pick<
          CheckInRow,
          "id" | "checked_on" | "mood" | "energy" | "focus" | "body" | "prompt_set_key"
        > | null) ?? null,
      },
    };
  } catch (error) {
    return { ok: false as const, message: toUserMessage(error) };
  }
}

export { getProfileTimeZone };
