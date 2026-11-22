import { requireUser } from "@/lib/auth/require-user";
import { AppError, toUserMessage } from "@/lib/errors";
import type { MilestoneRow, ProjectRow, TaskRow } from "@/lib/db/types";
import { createClient } from "@/lib/supabase/server";
import {
  createMilestoneSchema,
  createProjectSchema,
  createTaskSchema,
} from "@/modules/projects/schemas";

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
    const parsed = createProjectSchema.parse(input);
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
    const parsed = createMilestoneSchema.parse(input);
    const supabase = await createClient();
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
    const parsed = createTaskSchema.parse(input);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        user_id: user.id,
        project_id: parsed.projectId ?? null,
        milestone_id: parsed.milestoneId ?? null,
        title: parsed.title,
        notes: parsed.notes ?? null,
        status: parsed.status,
        due_on: parsed.dueOn ?? null,
      })
      .select("*")
      .single();
    if (error) throw new AppError("unavailable", "Could not create task.");
    return { ok: true as const, data: data as TaskRow };
  } catch (error) {
    return { ok: false as const, message: toUserMessage(error) };
  }
}
