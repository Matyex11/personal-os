"use server";

import { revalidatePath } from "next/cache";
import { closeChapter, createChapter } from "@/modules/chapters/service";
import {
  createHabit,
  listHabitRecoveryTargets,
  logHabit,
} from "@/modules/habits/service";
import { upsertModuleActivation } from "@/modules/modules/service";
import {
  createMilestone,
  createProject,
  createTask,
} from "@/modules/projects/service";

export async function createChapterAction(formData: FormData) {
  const result = await createChapter({
    title: String(formData.get("title") ?? ""),
    summary: String(formData.get("summary") ?? "") || undefined,
    status: String(formData.get("status") ?? "active"),
    startedOn: String(formData.get("startedOn") ?? ""),
    isCurrent: formData.get("isCurrent") === "on",
  });
  if (result.ok) revalidatePath("/chapters");
  return result;
}

export async function closeChapterAction(formData: FormData) {
  const result = await closeChapter({
    chapterId: String(formData.get("chapterId") ?? ""),
    endedOn: String(formData.get("endedOn") ?? ""),
  });
  if (result.ok) revalidatePath("/chapters");
  return result;
}

export async function upsertModuleAction(formData: FormData) {
  const result = await upsertModuleActivation({
    moduleKey: String(formData.get("moduleKey") ?? ""),
    isActive: formData.get("isActive") === "true",
    scope: "global",
  });
  if (result.ok) revalidatePath("/chapters");
  return result;
}

export async function createHabitAction(formData: FormData) {
  const weekdaysRaw = String(formData.get("weekdays") ?? "");
  const kind = String(formData.get("cadenceKind") ?? "daily");
  const startOn = String(formData.get("startOn") ?? new Date().toISOString().slice(0, 10));
  const result = await createHabit({
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? "") || undefined,
    minValue: Number(formData.get("minValue") ?? 1),
    targetValue: Number(formData.get("targetValue") ?? 1),
    unit: String(formData.get("unit") ?? "") || undefined,
    cadence: {
      kind,
      startOn,
      weekdays:
        kind === "weekdays"
          ? weekdaysRaw
              .split(",")
              .map((value) => Number(value.trim()))
              .filter(Boolean)
          : undefined,
    },
  });
  if (result.ok) revalidatePath("/habits");
  return result;
}

export async function logHabitAction(formData: FormData) {
  const recovers = String(formData.get("recoversLogId") ?? "");
  const result = await logHabit({
    habitId: String(formData.get("habitId") ?? ""),
    loggedOn: String(formData.get("loggedOn") ?? ""),
    status: String(formData.get("status") ?? ""),
    value: formData.get("value") ? Number(formData.get("value")) : undefined,
    notes: String(formData.get("notes") ?? "") || undefined,
    recoversLogId: recovers || undefined,
  });
  if (result.ok) revalidatePath("/habits");
  return result;
}

/** Load / page recovery-selector candidates (independent of recent history). */
export async function listHabitRecoveryTargetsAction(input: {
  habitId: string;
  cursor?: string | null;
}) {
  return listHabitRecoveryTargets(input);
}

export async function createProjectAction(formData: FormData) {
  const result = await createProject({
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? "") || undefined,
  });
  if (result.ok) revalidatePath("/projects");
  return result;
}

export async function createMilestoneAction(formData: FormData) {
  const result = await createMilestone({
    title: String(formData.get("title") ?? ""),
    projectId: String(formData.get("projectId") ?? "") || undefined,
  });
  if (result.ok) revalidatePath("/projects");
  return result;
}

export async function createTaskAction(formData: FormData) {
  const result = await createTask({
    title: String(formData.get("title") ?? ""),
    projectId: String(formData.get("projectId") ?? "") || undefined,
    milestoneId: String(formData.get("milestoneId") ?? "") || undefined,
  });
  if (result.ok) revalidatePath("/projects");
  return result;
}
