import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { AppError, toUserMessage } from "@/lib/errors";
import type { HabitLogRow, HabitRow, ProfileRow } from "@/lib/db/types";
import { createClient } from "@/lib/supabase/server";
import { nonEmptyStringSchema } from "@/lib/validation/common";
import { habitCadenceSchema, generateScheduledDates } from "@/modules/habits/cadence";
import { createHabitSchema, logHabitSchema } from "@/modules/habits/schemas";
import { validateHabitRecovery } from "@/modules/habits/recovery";
import {
  decodeRecoveryTargetCursor,
  encodeRecoveryTargetCursor,
  formatPostgrestInList,
  listRecoveryTargetsInputSchema,
  RECOVERY_TARGETS_PAGE_SIZE,
  type RecoveryTargetsPage,
} from "@/modules/habits/recovery-eligibility";
import {
  createHabitReportRangeSchema,
  firstZodIssueMessage,
} from "@/modules/habits/report-range";
import { summarizeAdherence } from "@/modules/habits/reporting";
import { DEFAULT_TIME_ZONE, todayInTimeZone } from "@/lib/dates/calendar";
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

    // Ownership: habit must belong to the session user (client habitId is untrusted).
    const { data: habit, error: habitError } = await supabase
      .from("habits")
      .select("id")
      .eq("id", parsed.habitId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (habitError) throw new AppError("unavailable", "Could not verify habit.");
    if (!habit) throw new AppError("not_found", "Habit not found.");

    if (parsed.status === "recovery") {
      if (!parsed.recoversLogId) {
        throw new AppError("validation", "Choose a missed or partial log to recover.");
      }

      const { data: original, error } = await supabase
        .from("habit_logs")
        .select("*")
        .eq("id", parsed.recoversLogId)
        .eq("user_id", user.id)
        .eq("habit_id", parsed.habitId)
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
          recoversLogId: parsed.recoversLogId,
          loggedOn: parsed.loggedOn,
          value: parsed.value,
          notes: parsed.notes,
        },
        mapped,
      );
      if (!check.ok) throw new AppError(check.code, check.message);

      // Stale UI: target already recovered (unique recovery link).
      const { data: existingRecovery, error: existingError } = await supabase
        .from("habit_logs")
        .select("id")
        .eq("user_id", user.id)
        .eq("habit_id", parsed.habitId)
        .eq("status", "recovery")
        .eq("recovers_log_id", parsed.recoversLogId)
        .maybeSingle();
      if (existingError) throw new AppError("unavailable", "Could not check recovery links.");
      if (existingRecovery) {
        throw new AppError(
          "conflict",
          "That log was already recovered. Refresh and pick another missed or partial entry.",
        );
      }
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

    if (error) {
      // Unique primary log / recovery constraints → safe conflict copy
      if (error.code === "23505") {
        throw new AppError(
          "conflict",
          "A log for that date or recovery target already exists.",
        );
      }
      throw new AppError("unavailable", "Could not save habit log.");
    }
    return { ok: true as const, data: data as HabitLogRow };
  } catch (error) {
    return { ok: false as const, message: toUserMessage(error) };
  }
}

/**
 * Profile IANA time zone for calendar “today” / reporting windows.
 * Falls back to Europe/Bucharest when unsigned or missing.
 */
export async function getProfileTimeZone(): Promise<string> {
  try {
    const user = await requireUser();
    const supabase = await createClient();
    const { data } = await supabase
      .from("profiles")
      .select("timezone")
      .eq("id", user.id)
      .maybeSingle();
    return (data as ProfileRow | null)?.timezone ?? DEFAULT_TIME_ZONE;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

/**
 * Single-habit adherence report for the authenticated user only.
 * Range validated server-side against profile-TZ today (max 366 days, no future).
 */
export async function reportHabitAdherence(input: unknown) {
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

    let parsed: { habitId: string; fromOn: string; toOn: string };
    try {
      parsed = createHabitReportRangeSchema(todayOn).parse(input);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AppError("validation", firstZodIssueMessage(error));
      }
      throw error;
    }

    const { data: habit, error: habitError } = await supabase
      .from("habits")
      .select("*")
      .eq("id", parsed.habitId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (habitError || !habit) {
      throw new AppError("not_found", "Habit not found.");
    }

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
        fromOn: parsed.fromOn,
        toOn: parsed.toOn,
        todayOn,
        timeZone,
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

/**
 * Recovery-selector candidates only — independent of recent-history (60).
 * Newest-first cursor pages on primary `logged_on` (unique per habit for non-recovery).
 */
export async function listHabitRecoveryTargets(input: unknown) {
  try {
    const user = await requireUser();
    const parsed = listRecoveryTargetsInputSchema.parse(input);
    const supabase = await createClient();

    const { data: habit, error: habitError } = await supabase
      .from("habits")
      .select("id")
      .eq("id", parsed.habitId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (habitError) throw new AppError("unavailable", "Could not verify habit.");
    if (!habit) throw new AppError("not_found", "Habit not found.");

    let beforeLoggedOn: string | null = null;
    if (parsed.cursor) {
      try {
        beforeLoggedOn = decodeRecoveryTargetCursor(parsed.cursor);
      } catch {
        throw new AppError("validation", "Invalid recovery list cursor.");
      }
    }

    const { data: recoveryLinks, error: linksError } = await supabase
      .from("habit_logs")
      .select("recovers_log_id")
      .eq("user_id", user.id)
      .eq("habit_id", parsed.habitId)
      .eq("status", "recovery")
      .not("recovers_log_id", "is", null);
    if (linksError) throw new AppError("unavailable", "Could not load recovery links.");

    const recoveredIds = [
      ...new Set(
        (recoveryLinks ?? [])
          .map((row) => row.recovers_log_id as string | null)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const recoveredInList = formatPostgrestInList(recoveredIds);

    const pageLimit = RECOVERY_TARGETS_PAGE_SIZE + 1;
    let query = supabase
      .from("habit_logs")
      .select("id, logged_on, status")
      .eq("user_id", user.id)
      .eq("habit_id", parsed.habitId)
      .in("status", ["missed", "partial"])
      .order("logged_on", { ascending: false })
      .limit(pageLimit);

    if (beforeLoggedOn) {
      query = query.lt("logged_on", beforeLoggedOn);
    }
    if (recoveredInList) {
      query = query.not("id", "in", recoveredInList);
    }

    const { data, error } = await query;
    if (error) throw new AppError("unavailable", "Could not load recovery targets.");

    const rows = (data ?? []) as Array<{
      id: string;
      logged_on: string;
      status: "missed" | "partial";
    }>;
    const hasMore = rows.length > RECOVERY_TARGETS_PAGE_SIZE;
    const page = rows.slice(0, RECOVERY_TARGETS_PAGE_SIZE);
    const last = page[page.length - 1];

    return {
      ok: true as const,
      data: {
        items: page.map((row) => ({
          id: row.id,
          logged_on: row.logged_on,
          status: row.status,
        })),
        nextCursor:
          hasMore && last ? encodeRecoveryTargetCursor(last.logged_on) : null,
        exhausted: !hasMore,
      } satisfies RecoveryTargetsPage,
    };
  } catch (error) {
    return { ok: false as const, message: toUserMessage(error) };
  }
}
