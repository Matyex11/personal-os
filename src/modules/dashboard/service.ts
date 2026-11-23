import { requireUser } from "@/lib/auth/require-user";
import { addCalendarDays, DEFAULT_TIME_ZONE, todayInTimeZone } from "@/lib/dates/calendar";
import { AppError, toUserMessage } from "@/lib/errors";
import type {
  ChapterRow,
  HabitLogRow,
  HabitRow,
  MilestoneRow,
  ProfileRow,
  ProjectRow,
  TaskRow,
} from "@/lib/db/types";
import { createClient } from "@/lib/supabase/server";
import {
  selectAttentionTasks,
  type AttentionTaskRow,
} from "@/modules/dashboard/attention-tasks";
import {
  buildTodaysHabitRows,
  type TodayHabitRow,
} from "@/modules/dashboard/habits-today";

export type CurrentChapterSummary = {
  id: string;
  title: string;
  startedOn: string;
  status: string;
};

/**
 * Current chapter only — never falls back to another chapter.
 */
export async function getDashboardCurrentChapter(): Promise<
  { ok: true; data: CurrentChapterSummary | null } | { ok: false; message: string }
> {
  try {
    const user = await requireUser();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("chapters")
      .select("id, title, started_on, status, is_current")
      .eq("user_id", user.id)
      .eq("is_current", true)
      .maybeSingle();
    if (error) throw new AppError("unavailable", "Could not load current chapter.");

    const row = data as Pick<
      ChapterRow,
      "id" | "title" | "started_on" | "status" | "is_current"
    > | null;

    if (!row) {
      return { ok: true, data: null };
    }

    return {
      ok: true,
      data: {
        id: row.id,
        title: row.title,
        startedOn: row.started_on,
        status: row.status,
      },
    };
  } catch (error) {
    return { ok: false, message: toUserMessage(error) };
  }
}

/**
 * Active habits for profile-TZ today. Logs queried for today only.
 */
export async function getDashboardTodaysHabits(): Promise<
  | {
      ok: true;
      data: { todayOn: string; timeZone: string; habits: TodayHabitRow[] };
    }
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
    const todayOn = todayInTimeZone(timeZone);

    const { data: habits, error: habitsError } = await supabase
      .from("habits")
      .select("id, name, is_active, cadence")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("name", { ascending: true });
    if (habitsError) throw new AppError("unavailable", "Could not load habits.");

    const { data: logs, error: logsError } = await supabase
      .from("habit_logs")
      .select("habit_id, logged_on, status")
      .eq("user_id", user.id)
      .eq("logged_on", todayOn);
    if (logsError) throw new AppError("unavailable", "Could not load today's habit logs.");

    const rows = buildTodaysHabitRows({
      habits: (habits ?? []) as Array<
        Pick<HabitRow, "id" | "name" | "is_active" | "cadence">
      >,
      logs: ((logs ?? []) as Array<
        Pick<HabitLogRow, "habit_id" | "logged_on" | "status">
      >).map((log) => ({
        habitId: log.habit_id,
        loggedOn: log.logged_on,
        status: log.status,
      })),
      todayOn,
      timeZone,
    });

    return { ok: true, data: { todayOn, timeZone, habits: rows } };
  } catch (error) {
    return { ok: false, message: toUserMessage(error) };
  }
}

/**
 * Open tasks overdue or due within 7 calendar days (profile TZ).
 */
export async function getDashboardAttentionTasks(): Promise<
  | {
      ok: true;
      data: { todayOn: string; tasks: AttentionTaskRow[] };
    }
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
    const todayOn = todayInTimeZone(timeZone);
    const horizon = addCalendarDays(todayOn, 7);

    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select("id, title, status, due_on, project_id, milestone_id")
      .eq("user_id", user.id)
      .in("status", ["todo", "doing"])
      .not("due_on", "is", null)
      .lte("due_on", horizon)
      .order("due_on", { ascending: true });
    if (tasksError) throw new AppError("unavailable", "Could not load tasks.");

    const taskRows = (tasks ?? []) as Array<
      Pick<TaskRow, "id" | "title" | "status" | "due_on" | "project_id" | "milestone_id">
    >;

    const projectIds = [
      ...new Set(
        taskRows
          .map((task) => task.project_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const milestoneIds = [
      ...new Set(
        taskRows
          .map((task) => task.milestone_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    let projects: Array<Pick<ProjectRow, "id" | "title">> = [];
    if (projectIds.length > 0) {
      const { data, error } = await supabase
        .from("projects")
        .select("id, title")
        .eq("user_id", user.id)
        .in("id", projectIds);
      if (error) throw new AppError("unavailable", "Could not load projects.");
      projects = (data ?? []) as Array<Pick<ProjectRow, "id" | "title">>;
    }

    let milestones: Array<Pick<MilestoneRow, "id" | "title">> = [];
    if (milestoneIds.length > 0) {
      const { data, error } = await supabase
        .from("milestones")
        .select("id, title")
        .eq("user_id", user.id)
        .in("id", milestoneIds);
      if (error) throw new AppError("unavailable", "Could not load milestones.");
      milestones = (data ?? []) as Array<Pick<MilestoneRow, "id" | "title">>;
    }

    const attention = selectAttentionTasks({
      tasks: taskRows,
      todayOn,
      projects,
      milestones,
    });

    return { ok: true, data: { todayOn, tasks: attention } };
  } catch (error) {
    return { ok: false, message: toUserMessage(error) };
  }
}
