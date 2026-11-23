"use server";

import { revalidatePath } from "next/cache";
import {
  activateChapter,
  closeChapter,
  createChapter,
  makeChapterCurrent,
} from "@/modules/chapters/service";
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
  updateMilestoneStatus,
  updateProjectStatus,
  updateTaskStatus,
} from "@/modules/projects/service";
import { updateProfileSettings } from "@/modules/profile/service";

export async function createChapterAction(formData: FormData) {
  const status = String(formData.get("status") ?? "active");
  // Never allow planned + is_current even if the checkbox was tampered.
  const isCurrent = status === "active" && formData.get("isCurrent") === "on";
  const result = await createChapter({
    title: String(formData.get("title") ?? ""),
    summary: String(formData.get("summary") ?? "") || undefined,
    status,
    startedOn: String(formData.get("startedOn") ?? ""),
    isCurrent,
  });
  if (result.ok) revalidatePath("/chapters");
  return result;
}

export async function activateChapterAction(formData: FormData) {
  const result = await activateChapter({
    chapterId: String(formData.get("chapterId") ?? ""),
  });
  if (result.ok) revalidatePath("/chapters");
  return result;
}

export async function makeChapterCurrentAction(formData: FormData) {
  const result = await makeChapterCurrent({
    chapterId: String(formData.get("chapterId") ?? ""),
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
  const scopeRaw = String(formData.get("scope") ?? "global");
  const scope = scopeRaw === "chapter" ? "chapter" : "global";
  const chapterIdRaw = String(formData.get("chapterId") ?? "").trim();
  const chapterId = chapterIdRaw || undefined;
  const result = await upsertModuleActivation({
    moduleKey: String(formData.get("moduleKey") ?? ""),
    isActive: formData.get("isActive") === "true",
    scope,
    ...(scope === "chapter" ? { chapterId } : {}),
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

export async function updateProjectStatusAction(formData: FormData) {
  const result = await updateProjectStatus({
    projectId: String(formData.get("projectId") ?? ""),
    status: String(formData.get("status") ?? ""),
  });
  if (result.ok) revalidatePath("/projects");
  return result;
}

export async function updateMilestoneStatusAction(formData: FormData) {
  const result = await updateMilestoneStatus({
    milestoneId: String(formData.get("milestoneId") ?? ""),
    status: String(formData.get("status") ?? ""),
  });
  if (result.ok) revalidatePath("/projects");
  return result;
}

export async function updateTaskStatusAction(formData: FormData) {
  const result = await updateTaskStatus({
    taskId: String(formData.get("taskId") ?? ""),
    status: String(formData.get("status") ?? ""),
  });
  if (result.ok) revalidatePath("/projects");
  return result;
}

export async function updateProfileSettingsAction(formData: FormData) {
  const result = await updateProfileSettings({
    displayName: String(formData.get("displayName") ?? ""),
    timezone: String(formData.get("timezone") ?? ""),
    baseCurrency: String(formData.get("baseCurrency") ?? ""),
  });
  if (result.ok) revalidatePath("/settings");
  return result;
}
