import { cache } from "react";
import { getOptionalUser } from "@/lib/auth/require-user";
import { AppError, toUserMessage } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import {
  isResolvedModuleActive,
  type ResolvedModuleActivation,
  type ResolvedModuleKey,
} from "@/modules/modules/resolve";
import { listModuleActivations } from "@/modules/modules/service";

export type NavVisibility = {
  dashboard: true;
  chapters: true;
  settings: true;
  habits: boolean;
  projects: boolean;
  checkins: boolean;
};

export type DashboardSectionVisibility = {
  currentChapter: true;
  todaysHabits: boolean;
  attentionTasks: boolean;
  todaysCheckIn: boolean;
};

export type ProjectsWorkspaceGating = {
  /** At least one of projects / milestones / tasks is active. */
  workspaceActive: boolean;
  projectsActive: boolean;
  milestonesActive: boolean;
  tasksActive: boolean;
  canCreateProject: boolean;
  canCreateMilestone: boolean;
  canCreateTask: boolean;
  canManageProjectStatus: boolean;
  canManageMilestoneStatus: boolean;
  canManageTaskStatus: boolean;
};

export type ModuleGatingState =
  | {
      status: "ok";
      chapterId: string | null;
      activations: ResolvedModuleActivation[];
      nav: NavVisibility;
      dashboard: DashboardSectionVisibility;
      projects: ProjectsWorkspaceGating;
      habitsActive: boolean;
      checkinsActive: boolean;
      resolutionFailed: false;
    }
  | {
      status: "error";
      message: string;
      chapterId: string | null;
      activations: null;
      nav: NavVisibility;
      dashboard: DashboardSectionVisibility;
      projects: ProjectsWorkspaceGating;
      habitsActive: boolean;
      checkinsActive: boolean;
      resolutionFailed: true;
    }
  | {
      status: "anonymous";
      chapterId: null;
      activations: null;
      nav: NavVisibility;
      dashboard: DashboardSectionVisibility;
      projects: ProjectsWorkspaceGating;
      habitsActive: boolean;
      checkinsActive: boolean;
      resolutionFailed: false;
    };

/** Preserve full nav when activation resolution fails or user is anonymous. */
export const PRESERVE_NAV_VISIBILITY: NavVisibility = {
  dashboard: true,
  chapters: true,
  settings: true,
  habits: true,
  projects: true,
  checkins: true,
};

/** On failure, keep dashboard sections available rather than silently hiding them. */
export const PRESERVE_DASHBOARD_VISIBILITY: DashboardSectionVisibility = {
  currentChapter: true,
  todaysHabits: true,
  attentionTasks: true,
  todaysCheckIn: true,
};

export const PRESERVE_PROJECTS_GATING: ProjectsWorkspaceGating = {
  workspaceActive: true,
  projectsActive: true,
  milestonesActive: true,
  tasksActive: true,
  canCreateProject: true,
  canCreateMilestone: true,
  canCreateTask: true,
  canManageProjectStatus: true,
  canManageMilestoneStatus: true,
  canManageTaskStatus: true,
};

export function navVisibilityFromActivations(
  resolved: ResolvedModuleActivation[],
): NavVisibility {
  const habits = isResolvedModuleActive(resolved, "habits");
  const projects = isResolvedModuleActive(resolved, "projects");
  const milestones = isResolvedModuleActive(resolved, "milestones");
  const tasks = isResolvedModuleActive(resolved, "tasks");
  const checkins = isResolvedModuleActive(resolved, "checkins");
  return {
    dashboard: true,
    chapters: true,
    settings: true,
    habits,
    projects: projects || milestones || tasks,
    checkins,
  };
}

export function dashboardVisibilityFromActivations(
  resolved: ResolvedModuleActivation[],
): DashboardSectionVisibility {
  return {
    currentChapter: true,
    todaysHabits: isResolvedModuleActive(resolved, "habits"),
    attentionTasks: isResolvedModuleActive(resolved, "tasks"),
    todaysCheckIn: isResolvedModuleActive(resolved, "checkins"),
  };
}

export function projectsWorkspaceFromActivations(
  resolved: ResolvedModuleActivation[],
): ProjectsWorkspaceGating {
  const projectsActive = isResolvedModuleActive(resolved, "projects");
  const milestonesActive = isResolvedModuleActive(resolved, "milestones");
  const tasksActive = isResolvedModuleActive(resolved, "tasks");
  return {
    workspaceActive: projectsActive || milestonesActive || tasksActive,
    projectsActive,
    milestonesActive,
    tasksActive,
    canCreateProject: projectsActive,
    canCreateMilestone: milestonesActive,
    canCreateTask: tasksActive,
    canManageProjectStatus: projectsActive,
    canManageMilestoneStatus: milestonesActive,
    canManageTaskStatus: tasksActive,
  };
}

async function loadCurrentChapterId(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chapters")
    .select("id")
    .eq("user_id", userId)
    .eq("is_current", true)
    .maybeSingle();
  if (error) throw new AppError("unavailable", "Could not load current chapter.");
  return (data as { id: string } | null)?.id ?? null;
}

/**
 * Session-scoped module gating for shell + pages.
 * Reuses listModuleActivations; cached per request.
 */
export const getSessionModuleGating = cache(async (): Promise<ModuleGatingState> => {
  const user = await getOptionalUser();
  if (!user) {
    return {
      status: "anonymous",
      chapterId: null,
      activations: null,
      nav: PRESERVE_NAV_VISIBILITY,
      dashboard: PRESERVE_DASHBOARD_VISIBILITY,
      projects: PRESERVE_PROJECTS_GATING,
      habitsActive: true,
      checkinsActive: true,
      resolutionFailed: false,
    };
  }

  let chapterId: string | null = null;
  try {
    chapterId = await loadCurrentChapterId(user.id);
  } catch (error) {
    return {
      status: "error",
      message: toUserMessage(error),
      chapterId: null,
      activations: null,
      nav: PRESERVE_NAV_VISIBILITY,
      dashboard: PRESERVE_DASHBOARD_VISIBILITY,
      projects: PRESERVE_PROJECTS_GATING,
      habitsActive: true,
      checkinsActive: true,
      resolutionFailed: true,
    };
  }

  const modules = await listModuleActivations(chapterId ?? undefined);
  if (!modules.ok) {
    return {
      status: "error",
      message: modules.message,
      chapterId,
      activations: null,
      nav: PRESERVE_NAV_VISIBILITY,
      dashboard: PRESERVE_DASHBOARD_VISIBILITY,
      projects: PRESERVE_PROJECTS_GATING,
      habitsActive: true,
      checkinsActive: true,
      resolutionFailed: true,
    };
  }

  const activations = modules.data;
  return {
    status: "ok",
    chapterId,
    activations,
    nav: navVisibilityFromActivations(activations),
    dashboard: dashboardVisibilityFromActivations(activations),
    projects: projectsWorkspaceFromActivations(activations),
    habitsActive: isResolvedModuleActive(activations, "habits"),
    checkinsActive: isResolvedModuleActive(activations, "checkins"),
    resolutionFailed: false,
  };
});

export function moduleActiveFromGating(
  gating: ModuleGatingState,
  moduleKey: ResolvedModuleKey,
): boolean {
  if (gating.status !== "ok" || !gating.activations) {
    // Failure / anonymous: do not treat as legitimate default-off.
    return true;
  }
  return isResolvedModuleActive(gating.activations, moduleKey);
}
