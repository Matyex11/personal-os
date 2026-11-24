import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import {
  DEFAULT_TIME_ZONE,
  isoWeekBounds,
  todayInTimeZone,
} from "@/lib/dates/calendar";
import type {
  CheckInRow,
  HabitLogRow,
  HabitRow,
  ProfileRow,
  ProjectRow,
  ReviewRow,
  TaskRow,
} from "@/lib/db/types";
import { AppError, toUserMessage } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { habitCadenceSchema, generateScheduledDates } from "@/modules/habits/cadence";
import { getProfileTimeZone } from "@/modules/habits/service";
import { summarizeAdherence } from "@/modules/habits/reporting";
import {
  REVIEW_PERIOD_KIND_WEEKLY,
  completeReviewSchema,
  getOrCreateWeeklyReviewSchema,
  listReviewsSchema,
  reopenReviewSchema,
  updateDraftReviewSchema,
  type WeeklyAnswers,
} from "@/modules/reviews/schemas";
import {
  buildWeeklyReviewSummary,
  type HabitAdherenceSlice,
  type WeeklyReviewSummary,
} from "@/modules/reviews/summary";

function firstZodIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input.";
}

function isUniqueViolation(error: { code?: string } | null | undefined): boolean {
  return error?.code === "23505";
}

function normalizeAnswers(raw: unknown): WeeklyAnswers {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const obj = raw as Record<string, unknown>;
  const pick = (key: string): string | undefined => {
    const value = obj[key];
    return typeof value === "string" && value.trim().length > 0 ? value : undefined;
  };
  return {
    wentWell: pick("wentWell"),
    didNotGoWell: pick("didNotGoWell"),
    learned: pick("learned"),
    mattersNext: pick("mattersNext"),
  };
}

export function mapReviewRow(row: ReviewRow) {
  return {
    id: row.id,
    userId: row.user_id,
    chapterId: row.chapter_id,
    periodKind: row.period_kind,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    status: row.status,
    answers: normalizeAnswers(row.answers),
    narrative: row.narrative,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function loadWeekBoundsForUser(weekOf?: string): Promise<{
  timeZone: string;
  todayOn: string;
  periodStart: string;
  periodEnd: string;
}> {
  const timeZone = await getProfileTimeZone();
  const todayOn = todayInTimeZone(timeZone);
  const anchor = weekOf ?? todayOn;
  const bounds = isoWeekBounds(anchor, timeZone);
  return { timeZone, todayOn, ...bounds };
}

async function selectWeeklyReview(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  periodStart: string,
  periodEnd: string,
): Promise<ReviewRow | null> {
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("user_id", userId)
    .eq("period_kind", REVIEW_PERIOD_KIND_WEEKLY)
    .eq("period_start", periodStart)
    .eq("period_end", periodEnd)
    .maybeSingle();
  if (error) throw new AppError("unavailable", "Could not load review.");
  return (data as ReviewRow | null) ?? null;
}

/**
 * Load current ISO week review or create a draft shell.
 * On unique conflict (23505): reselect once — no elaborate retry loop.
 */
export async function getOrCreateWeeklyReview(input: unknown = {}) {
  try {
    const user = await requireUser();
    let parsed: z.infer<typeof getOrCreateWeeklyReviewSchema>;
    try {
      parsed = getOrCreateWeeklyReviewSchema.parse(input ?? {});
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AppError("validation", firstZodIssueMessage(error));
      }
      throw error;
    }

    const { periodStart, periodEnd, timeZone, todayOn } = await loadWeekBoundsForUser(
      parsed.weekOf,
    );
    const supabase = await createClient();

    const existing = await selectWeeklyReview(supabase, user.id, periodStart, periodEnd);
    if (existing) {
      return {
        ok: true as const,
        data: {
          review: mapReviewRow(existing),
          periodStart,
          periodEnd,
          timeZone,
          todayOn,
          created: false,
        },
      };
    }

    const inserted = await supabase
      .from("reviews")
      .insert({
        user_id: user.id,
        chapter_id: null,
        period_kind: REVIEW_PERIOD_KIND_WEEKLY,
        period_start: periodStart,
        period_end: periodEnd,
        status: "draft",
        answers: {},
        narrative: null,
        completed_at: null,
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (inserted.error) {
      if (isUniqueViolation(inserted.error)) {
        const winner = await selectWeeklyReview(supabase, user.id, periodStart, periodEnd);
        if (!winner) {
          throw new AppError(
            "conflict",
            "A review for this week already exists, but could not be loaded.",
          );
        }
        return {
          ok: true as const,
          data: {
            review: mapReviewRow(winner),
            periodStart,
            periodEnd,
            timeZone,
            todayOn,
            created: false,
          },
        };
      }
      throw new AppError("unavailable", "Could not create weekly review.");
    }

    return {
      ok: true as const,
      data: {
        review: mapReviewRow(inserted.data as ReviewRow),
        periodStart,
        periodEnd,
        timeZone,
        todayOn,
        created: true,
      },
    };
  } catch (error) {
    return { ok: false as const, message: toUserMessage(error) };
  }
}

export async function updateDraftReview(input: unknown) {
  try {
    const user = await requireUser();
    let parsed: z.infer<typeof updateDraftReviewSchema>;
    try {
      parsed = updateDraftReviewSchema.parse(input);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AppError("validation", firstZodIssueMessage(error));
      }
      throw error;
    }

    const supabase = await createClient();
    const { data: existing, error: loadError } = await supabase
      .from("reviews")
      .select("*")
      .eq("id", parsed.id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (loadError) throw new AppError("unavailable", "Could not load review.");
    if (!existing) throw new AppError("not_found", "Review not found.");
    const row = existing as ReviewRow;
    if (row.status !== "draft") {
      throw new AppError("conflict", "Completed reviews are read-only until reopened.");
    }

    const answers: WeeklyAnswers = {
      ...(parsed.answers.wentWell !== undefined ? { wentWell: parsed.answers.wentWell } : {}),
      ...(parsed.answers.didNotGoWell !== undefined
        ? { didNotGoWell: parsed.answers.didNotGoWell }
        : {}),
      ...(parsed.answers.learned !== undefined ? { learned: parsed.answers.learned } : {}),
      ...(parsed.answers.mattersNext !== undefined
        ? { mattersNext: parsed.answers.mattersNext }
        : {}),
    };

    const updated = await supabase
      .from("reviews")
      .update({
        answers,
        updated_at: new Date().toISOString(),
      })
      .eq("id", parsed.id)
      .eq("user_id", user.id)
      .eq("status", "draft")
      .select("*")
      .maybeSingle();
    if (updated.error) throw new AppError("unavailable", "Could not save draft.");
    if (!updated.data) {
      throw new AppError("conflict", "Completed reviews are read-only until reopened.");
    }
    return { ok: true as const, data: mapReviewRow(updated.data as ReviewRow) };
  } catch (error) {
    return { ok: false as const, message: toUserMessage(error) };
  }
}

export async function completeReview(input: unknown) {
  try {
    const user = await requireUser();
    let parsed: z.infer<typeof completeReviewSchema>;
    try {
      parsed = completeReviewSchema.parse(input);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AppError("validation", firstZodIssueMessage(error));
      }
      throw error;
    }

    const supabase = await createClient();
    const { data: existing, error: loadError } = await supabase
      .from("reviews")
      .select("*")
      .eq("id", parsed.id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (loadError) throw new AppError("unavailable", "Could not load review.");
    if (!existing) throw new AppError("not_found", "Review not found.");
    const row = existing as ReviewRow;
    if (row.status === "completed") {
      return { ok: true as const, data: mapReviewRow(row) };
    }

    const now = new Date().toISOString();
    const updated = await supabase
      .from("reviews")
      .update({
        status: "completed",
        completed_at: now,
        updated_at: now,
      })
      .eq("id", parsed.id)
      .eq("user_id", user.id)
      .eq("status", "draft")
      .select("*")
      .maybeSingle();
    if (updated.error) throw new AppError("unavailable", "Could not complete review.");
    if (!updated.data) {
      throw new AppError("conflict", "Review could not be completed.");
    }
    return { ok: true as const, data: mapReviewRow(updated.data as ReviewRow) };
  } catch (error) {
    return { ok: false as const, message: toUserMessage(error) };
  }
}

export async function reopenReview(input: unknown) {
  try {
    const user = await requireUser();
    let parsed: z.infer<typeof reopenReviewSchema>;
    try {
      parsed = reopenReviewSchema.parse(input);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AppError("validation", firstZodIssueMessage(error));
      }
      throw error;
    }

    const supabase = await createClient();
    const { data: existing, error: loadError } = await supabase
      .from("reviews")
      .select("*")
      .eq("id", parsed.id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (loadError) throw new AppError("unavailable", "Could not load review.");
    if (!existing) throw new AppError("not_found", "Review not found.");
    const row = existing as ReviewRow;
    if (row.status === "draft") {
      return { ok: true as const, data: mapReviewRow(row) };
    }

    const updated = await supabase
      .from("reviews")
      .update({
        status: "draft",
        completed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", parsed.id)
      .eq("user_id", user.id)
      .eq("status", "completed")
      .select("*")
      .maybeSingle();
    if (updated.error) throw new AppError("unavailable", "Could not reopen review.");
    if (!updated.data) throw new AppError("conflict", "Review could not be reopened.");
    return { ok: true as const, data: mapReviewRow(updated.data as ReviewRow) };
  } catch (error) {
    return { ok: false as const, message: toUserMessage(error) };
  }
}

export async function listReviews(input: unknown = {}) {
  try {
    const user = await requireUser();
    let parsed: z.infer<typeof listReviewsSchema>;
    try {
      parsed = listReviewsSchema.parse(input ?? {});
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AppError("validation", firstZodIssueMessage(error));
      }
      throw error;
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("reviews")
      .select("*")
      .eq("user_id", user.id)
      .eq("period_kind", REVIEW_PERIOD_KIND_WEEKLY)
      .order("period_start", { ascending: false })
      .limit(parsed.limit);
    if (error) throw new AppError("unavailable", "Could not load reviews.");
    return {
      ok: true as const,
      data: ((data ?? []) as ReviewRow[]).map(mapReviewRow),
    };
  } catch (error) {
    return { ok: false as const, message: toUserMessage(error) };
  }
}

/** Dashboard cue: missing | draft | completed for the current ISO week. */
export async function getCurrentWeekReviewStatus() {
  try {
    const user = await requireUser();
    const { periodStart, periodEnd, timeZone, todayOn } = await loadWeekBoundsForUser();
    const supabase = await createClient();
    const row = await selectWeeklyReview(supabase, user.id, periodStart, periodEnd);
    const state: "missing" | "draft" | "completed" = !row
      ? "missing"
      : row.status === "completed"
        ? "completed"
        : "draft";
    return {
      ok: true as const,
      data: {
        state,
        periodStart,
        periodEnd,
        timeZone,
        todayOn,
        review: row ? mapReviewRow(row) : null,
      },
    };
  } catch (error) {
    return { ok: false as const, message: toUserMessage(error) };
  }
}

/**
 * Display-time summary for a week window — never persisted.
 * Habit adherence / check-in averages degrade gracefully when empty.
 */
export async function getWeeklyReviewSummary(periodStart: string, periodEnd: string): Promise<
  | { ok: true; data: WeeklyReviewSummary }
  | { ok: false; message: string }
> {
  try {
    const user = await requireUser();
    const supabase = await createClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("timezone")
      .eq("id", user.id)
      .maybeSingle();
    const timeZone = (profile as ProfileRow | null)?.timezone ?? DEFAULT_TIME_ZONE;

    const { data: habits, error: habitsError } = await supabase
      .from("habits")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true);
    if (habitsError) throw new AppError("unavailable", "Could not load habits.");

    const habitRows = (habits ?? []) as HabitRow[];
    const habitSlices: HabitAdherenceSlice[] = [];

    for (const habit of habitRows) {
      let cadence;
      try {
        cadence = habitCadenceSchema.parse(habit.cadence);
      } catch {
        continue;
      }
      const scheduledDates = generateScheduledDates(cadence, {
        fromOn: periodStart,
        toOn: periodEnd,
        timeZone,
      });
      const { data: logs, error: logsError } = await supabase
        .from("habit_logs")
        .select("logged_on, status")
        .eq("user_id", user.id)
        .eq("habit_id", habit.id)
        .gte("logged_on", periodStart)
        .lte("logged_on", periodEnd);
      if (logsError) throw new AppError("unavailable", "Could not load habit logs.");

      const summary = summarizeAdherence({
        scheduledDates,
        logs: ((logs ?? []) as Array<Pick<HabitLogRow, "logged_on" | "status">>).map(
          (log) => ({
            loggedOn: log.logged_on,
            status: log.status,
          }),
        ),
      });
      habitSlices.push({
        habitId: habit.id,
        habitName: habit.name,
        scheduledOccurrences: summary.scheduledOccurrences,
        completedCount: summary.completedCount,
        partialCount: summary.partialCount,
        missedCount: summary.missedCount,
        unloggedCount: summary.unloggedCount,
        targetAttainment: summary.targetAttainment,
        minimumAdherence: summary.minimumAdherence,
      });
    }

    const { data: projects, error: projectsError } = await supabase
      .from("projects")
      .select("status")
      .eq("user_id", user.id);
    if (projectsError) throw new AppError("unavailable", "Could not load projects.");

    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select("status")
      .eq("user_id", user.id);
    if (tasksError) throw new AppError("unavailable", "Could not load tasks.");

    const { data: checkIns, error: checkInsError } = await supabase
      .from("check_ins")
      .select("checked_on, mood, energy, focus")
      .eq("user_id", user.id)
      .gte("checked_on", periodStart)
      .lte("checked_on", periodEnd);
    if (checkInsError) throw new AppError("unavailable", "Could not load check-ins.");

    const summary = buildWeeklyReviewSummary({
      periodStart,
      periodEnd,
      habits: habitSlices,
      projects: ((projects ?? []) as Array<Pick<ProjectRow, "status">>).map((row) => ({
        status: row.status,
      })),
      tasks: ((tasks ?? []) as Array<Pick<TaskRow, "status">>).map((row) => ({
        status: row.status,
      })),
      checkIns: (
        (checkIns ?? []) as Array<
          Pick<CheckInRow, "checked_on" | "mood" | "energy" | "focus">
        >
      ).map((row) => ({
        checkedOn: row.checked_on,
        mood: row.mood,
        energy: row.energy,
        focus: row.focus,
      })),
    });

    return { ok: true as const, data: summary };
  } catch (error) {
    return { ok: false as const, message: toUserMessage(error) };
  }
}

export { getProfileTimeZone };
