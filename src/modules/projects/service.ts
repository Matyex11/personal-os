import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { AppError, toUserMessage } from "@/lib/errors";
import type { MilestoneRow, ProjectRow, TaskRow } from "@/lib/db/types";
import { createClient } from "@/lib/supabase/server";
import { todayInTimeZone } from "@/lib/dates/calendar";
import { resolveTaskParents } from "@/modules/projects/relationships";
import {
  createMilestoneSchema,
  createProjectSchema,
  createTaskSchema,
  updateMilestoneStatusSchema,
  updateProjectStatusSchema,
  updateTaskStatusSchema,
} from "@/modules/projects/schemas";
import { getProfileTimeZone } from "@/modules/habits/service";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

function zodMessage(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? "Invalid input.";
  }
  return toUserMessage(error);
}

function parseOrThrow<T>(schema: z.ZodType<T>, input: unknown): T {
  try {
    return schema.parse(input);
  } catch (error) {
    throw new AppError("validation", zodMessage(error));
  }
}

async function loadOwnedProject(
  supabase: SupabaseServer,
  userId: string,
  projectId: string,
): Promise<ProjectRow | null> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new AppError("unavailable", "Could not load project.");
  return (data as ProjectRow | null) ?? null;
}

async function loadOwnedMilestone(
  supabase: SupabaseServer,
  userId: string,
  milestoneId: string,
): Promise<MilestoneRow | null> {
  const { data, error } = await supabase
    .from("milestones")
    .select("*")
    .eq("id", milestoneId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new AppError("unavailable", "Could not load milestone.");
  return (data as MilestoneRow | null) ?? null;
}

export async function listProjects() {
  try {
    const user = await requireUser();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) throw new AppError("unavailable", "Could not load projects.");
    return { ok: true as const, data: (data ?? []) as ProjectRow[] };
  } catch (error) {
    return { ok: false as const, message: toUserMessage(error) };
  }
}

export async function createProject(input: unknown) {
  try {
    const user = await requireUser();
    const parsed = parseOrThrow(createProjectSchema, input);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("projects")
      .insert({
        user_id: user.id,
        chapter_id: parsed.chapterId ?? null,
        title: parsed.title,
        description: parsed.description ?? null,
        status: parsed.status,
        priority: parsed.priority ?? null,
        target_date: parsed.targetDate ?? null,
      })
      .select("*")
      .single();
    if (error) throw new AppError("unavailable", "Could not create project.");
    return { ok: true as const, data: data as ProjectRow };
  } catch (error) {
    return { ok: false as const, message: toUserMessage(error) };
  }
}

export async function updateProjectStatus(input: unknown) {
  try {
    const user = await requireUser();
    const parsed = parseOrThrow(updateProjectStatusSchema, input);
    const supabase = await createClient();
    const existing = await loadOwnedProject(supabase, user.id, parsed.projectId);
    if (!existing) throw new AppError("not_found", "Project not found.");

    const { data, error } = await supabase
      .from("projects")
      .update({ status: parsed.status })
      .eq("id", parsed.projectId)
      .eq("user_id", user.id)
      .select("*")
      .maybeSingle();
    if (error) throw new AppError("unavailable", "Could not update project status.");
    if (!data) throw new AppError("not_found", "Project not found.");
    return { ok: true as const, data: data as ProjectRow };
  } catch (error) {
    return { ok: false as const, message: toUserMessage(error) };
  }
}

export async function listMilestones(projectId?: string) {
  try {
    const user = await requireUser();
    const supabase = await createClient();
    let query = supabase.from("milestones").select("*").eq("user_id", user.id);
    if (projectId) query = query.eq("project_id", projectId);
    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) throw new AppError("unavailable", "Could not load milestones.");
    return { ok: true as const, data: (data ?? []) as MilestoneRow[] };
  } catch (error) {
    return { ok: false as const, message: toUserMessage(error) };
  }
}

export async function createMilestone(input: unknown) {
  try {
    const user = await requireUser();
    const parsed = parseOrThrow(createMilestoneSchema, input);
    const supabase = await createClient();

    if (parsed.projectId) {
      const project = await loadOwnedProject(supabase, user.id, parsed.projectId);
      if (!project) throw new AppError("not_found", "Project not found.");
    }

    const { data, error } = await supabase
      .from("milestones")
      .insert({
        user_id: user.id,
        project_id: parsed.projectId ?? null,
        title: parsed.title,
        description: parsed.description ?? null,
        status: parsed.status,
        target_on: parsed.targetOn ?? null,
      })
      .select("*")
      .single();
    if (error) throw new AppError("unavailable", "Could not create milestone.");
    return { ok: true as const, data: data as MilestoneRow };
  } catch (error) {
    return { ok: false as const, message: toUserMessage(error) };
  }
}

export async function updateMilestoneStatus(input: unknown) {
  try {
    const user = await requireUser();
    const parsed = parseOrThrow(updateMilestoneStatusSchema, input);
    const supabase = await createClient();
    const existing = await loadOwnedMilestone(supabase, user.id, parsed.milestoneId);
    if (!existing) throw new AppError("not_found", "Milestone not found.");

    const timeZone = await getProfileTimeZone();
    const today = todayInTimeZone(timeZone);
    const patch: { status: string; achieved_on: string | null } = {
      status: parsed.status,
      achieved_on:
        parsed.status === "hit"
          ? existing.achieved_on ?? today
          : null,
    };

    const { data, error } = await supabase
      .from("milestones")
      .update(patch)
      .eq("id", parsed.milestoneId)
      .eq("user_id", user.id)
      .select("*")
      .maybeSingle();
    if (error) throw new AppError("unavailable", "Could not update milestone status.");
    if (!data) throw new AppError("not_found", "Milestone not found.");
    return { ok: true as const, data: data as MilestoneRow };
  } catch (error) {
    return { ok: false as const, message: toUserMessage(error) };
  }
}

export async function listTasks() {
  try {
    const user = await requireUser();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) throw new AppError("unavailable", "Could not load tasks.");
    return { ok: true as const, data: (data ?? []) as TaskRow[] };
  } catch (error) {
    return { ok: false as const, message: toUserMessage(error) };
  }
}

export async function createTask(input: unknown) {
  try {
    const user = await requireUser();
    const parsed = parseOrThrow(createTaskSchema, input);
    const supabase = await createClient();

    let milestone: MilestoneRow | null = null;
    if (parsed.milestoneId) {
      milestone = await loadOwnedMilestone(supabase, user.id, parsed.milestoneId);
      if (!milestone) throw new AppError("not_found", "Milestone not found.");
    }

    if (parsed.projectId) {
      const project = await loadOwnedProject(supabase, user.id, parsed.projectId);
      if (!project) throw new AppError("not_found", "Project not found.");
    }

    const resolved = resolveTaskParents({
      projectId: parsed.projectId,
      milestoneId: parsed.milestoneId,
      milestone: milestone
        ? { id: milestone.id, project_id: milestone.project_id }
        : null,
    });
    if (!resolved.ok) throw new AppError("validation", resolved.message);

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        user_id: user.id,
        project_id: resolved.projectId,
        milestone_id: resolved.milestoneId,
        title: parsed.title,
        notes: parsed.notes ?? null,
        status: parsed.status,
        due_on: parsed.dueOn ?? null,
        completed_at: parsed.status === "done" ? new Date().toISOString() : null,
      })
      .select("*")
      .single();
    if (error) throw new AppError("unavailable", "Could not create task.");
    return { ok: true as const, data: data as TaskRow };
  } catch (error) {
    return { ok: false as const, message: toUserMessage(error) };
  }
}

export async function updateTaskStatus(input: unknown) {
  try {
    const user = await requireUser();
    const parsed = parseOrThrow(updateTaskStatusSchema, input);
    const supabase = await createClient();

    const { data: existing, error: loadError } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", parsed.taskId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (loadError) throw new AppError("unavailable", "Could not load task.");
    if (!existing) throw new AppError("not_found", "Task not found.");

    const patch: { status: string; completed_at: string | null } = {
      status: parsed.status,
      completed_at:
        parsed.status === "done"
          ? (existing as TaskRow).completed_at ?? new Date().toISOString()
          : null,
    };

    const { data, error } = await supabase
      .from("tasks")
      .update(patch)
      .eq("id", parsed.taskId)
      .eq("user_id", user.id)
      .select("*")
      .maybeSingle();
    if (error) throw new AppError("unavailable", "Could not update task status.");
    if (!data) throw new AppError("not_found", "Task not found.");
    return { ok: true as const, data: data as TaskRow };
  } catch (error) {
    return { ok: false as const, message: toUserMessage(error) };
  }
}
