import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { AppError, toUserMessage } from "@/lib/errors";
import type { HabitLogRow, HabitRow, ProfileRow } from "@/lib/db/types";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema, nonEmptyStringSchema, isoDateSchema } from "@/lib/validation/common";
import { habitCadenceSchema, generateScheduledDates } from "@/modules/habits/cadence";
import { createHabitSchema, logHabitSchema } from "@/modules/habits/schemas";
import { validateHabitRecovery } from "@/modules/habits/recovery";
import { summarizeAdherence } from "@/modules/habits/reporting";
import type { HabitLog } from "@/types/domain";

export async function listHabits() {
  try {
    const user = await requireUser();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("habits")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) throw new AppError("unavailable", "Could not load habits.");
    return { ok: true as const, data: (data ?? []) as HabitRow[] };
  } catch (error) {
    return { ok: false as const, message: toUserMessage(error) };
  }
}

export async function createHabit(input: unknown) {
  try {
    const user = await requireUser();
    // Server-only write boundary: cadence + values validated before insert.
    // DB also CHECKs is_valid_habit_cadence(cadence) and min_value >= 0.
    const parsed = createHabitSchema.parse(input);

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("habits")
      .insert({
        user_id: user.id,
        chapter_id: parsed.chapterId ?? null,
        name: parsed.name,
        description: parsed.description ?? null,
        cadence: parsed.cadence,
        min_value: parsed.minValue,
        target_value: parsed.targetValue,
        unit: parsed.unit ?? null,
        is_active: true,
      })
      .select("*")
      .single();

    if (error) throw new AppError("unavailable", "Could not create habit.");
    return { ok: true as const, data: data as HabitRow };
  } catch (error) {
    return { ok: false as const, message: toUserMessage(error) };
  }
}

export async function logHabit(input: unknown) {
  try {
    const user = await requireUser();
    const parsed = logHabitSchema.parse(input);
    const supabase = await createClient();

    if (parsed.status === "recovery") {
      const { data: original, error } = await supabase
        .from("habit_logs")
        .select("*")
        .eq("id", parsed.recoversLogId!)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw new AppError("unavailable", "Could not load original log.");

      const mapped: HabitLog | null = original
        ? {
            id: original.id,
            userId: original.user_id,
            habitId: original.habit_id,
            loggedOn: original.logged_on,
            status: original.status,
            value: original.value,
            notes: original.notes ?? undefined,
            recoversLogId: original.recovers_log_id,
          }
        : null;

      const check = validateHabitRecovery(
        {
          userId: user.id,
          habitId: parsed.habitId,
          recoversLogId: parsed.recoversLogId!,
          loggedOn: parsed.loggedOn,
          value: parsed.value,
          notes: parsed.notes,
        },
        mapped,
      );
      if (!check.ok) throw new AppError(check.code, check.message);
    }

    const { data, error } = await supabase
      .from("habit_logs")
      .insert({
        user_id: user.id,
        habit_id: parsed.habitId,
        logged_on: parsed.loggedOn,
        status: parsed.status,
        value: parsed.value ?? null,
        notes: parsed.notes ?? null,
        recovers_log_id: parsed.recoversLogId ?? null,
      })
      .select("*")
      .single();

    if (error) throw new AppError("unavailable", "Could not save habit log.");
    return { ok: true as const, data: data as HabitLogRow };
  } catch (error) {
    return { ok: false as const, message: toUserMessage(error) };
  }
}

const reportSchema = z.object({
  habitId: uuidSchema,
  fromOn: isoDateSchema,
  toOn: isoDateSchema,
});

/**
 * Single-habit adherence report for the authenticated user only.
 */
export async function reportHabitAdherence(input: unknown) {
  try {
    const user = await requireUser();
    const parsed = reportSchema.parse(input);
    const supabase = await createClient();

    const { data: habit, error: habitError } = await supabase
      .from("habits")
      .select("*")
      .eq("id", parsed.habitId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (habitError || !habit) {
      throw new AppError("not_found", "Habit not found.");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("timezone")
      .eq("id", user.id)
      .maybeSingle();

    const timeZone = (profile as ProfileRow | null)?.timezone ?? "Europe/Bucharest";
    const cadence = habitCadenceSchema.parse(habit.cadence);
    const scheduledDates = generateScheduledDates(cadence, {
      fromOn: parsed.fromOn,
      toOn: parsed.toOn,
      timeZone,
    });

    const { data: logs, error: logsError } = await supabase
      .from("habit_logs")
      .select("*")
      .eq("user_id", user.id)
      .eq("habit_id", parsed.habitId)
      .gte("logged_on", parsed.fromOn)
      .lte("logged_on", parsed.toOn);
    if (logsError) throw new AppError("unavailable", "Could not load habit logs.");

    const summary = summarizeAdherence({
      scheduledDates,
      logs: (logs ?? []).map((row) => ({
        loggedOn: row.logged_on as string,
        status: row.status,
      })),
    });

    return {
      ok: true as const,
      data: {
        habit: habit as HabitRow,
        scheduledDates,
        summary,
      },
    };
  } catch (error) {
    return { ok: false as const, message: toUserMessage(error) };
  }
}

export async function listHabitLogs(habitId: string) {
  try {
    const user = await requireUser();
    nonEmptyStringSchema.parse(habitId);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("habit_logs")
      .select("*")
      .eq("user_id", user.id)
      .eq("habit_id", habitId)
      .order("logged_on", { ascending: false })
      .limit(60);
    if (error) throw new AppError("unavailable", "Could not load logs.");
    return { ok: true as const, data: (data ?? []) as HabitLogRow[] };
  } catch (error) {
    return { ok: false as const, message: toUserMessage(error) };
  }
}
