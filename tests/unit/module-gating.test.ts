import { describe, expect, it } from "vitest";
import {
  dashboardVisibilityFromActivations,
  moduleActiveFromGating,
  navVisibilityFromActivations,
  PRESERVE_DASHBOARD_VISIBILITY,
  PRESERVE_NAV_VISIBILITY,
  PRESERVE_PROJECTS_GATING,
  projectsWorkspaceFromActivations,
  type ModuleGatingState,
} from "@/modules/modules/gating";
import type { ResolvedModuleActivation } from "@/modules/modules/resolve";
import { MODULE_KEYS } from "@/modules/modules/resolve";

function activations(
  overrides: Partial<Record<(typeof MODULE_KEYS)[number], boolean>>,
): ResolvedModuleActivation[] {
  return MODULE_KEYS.map((moduleKey) => ({
    moduleKey,
    isActive: overrides[moduleKey] ?? false,
    source: (overrides[moduleKey] === undefined
      ? "default_off"
      : "global") as ResolvedModuleActivation["source"],
  }));
}

describe("navVisibilityFromActivations", () => {
  it("always keeps dashboard, chapters, and settings", () => {
    const nav = navVisibilityFromActivations(activations({}));
    expect(nav.dashboard).toBe(true);
    expect(nav.chapters).toBe(true);
    expect(nav.settings).toBe(true);
    expect(nav.habits).toBe(false);
    expect(nav.projects).toBe(false);
    expect(nav.checkins).toBe(false);
    expect(nav.reviews).toBe(false);
  });

  it("shows habits only when habits is active", () => {
    expect(navVisibilityFromActivations(activations({ habits: true })).habits).toBe(true);
    expect(navVisibilityFromActivations(activations({ tasks: true })).habits).toBe(false);
  });

  it("shows checkins only when checkins is active", () => {
    expect(navVisibilityFromActivations(activations({ checkins: true })).checkins).toBe(true);
    expect(navVisibilityFromActivations(activations({ habits: true })).checkins).toBe(false);
  });

  it("shows reviews only when reviews is active", () => {
    expect(navVisibilityFromActivations(activations({ reviews: true })).reviews).toBe(true);
    expect(navVisibilityFromActivations(activations({ checkins: true })).reviews).toBe(false);
  });

  it("shows projects when any of projects/milestones/tasks is active", () => {
    expect(navVisibilityFromActivations(activations({ projects: true })).projects).toBe(true);
    expect(navVisibilityFromActivations(activations({ milestones: true })).projects).toBe(true);
    expect(navVisibilityFromActivations(activations({ tasks: true })).projects).toBe(true);
    expect(
      navVisibilityFromActivations(activations({ habits: true, finances: true })).projects,
    ).toBe(false);
  });
});

describe("dashboardVisibilityFromActivations", () => {
  it("always shows current chapter and gates habits/tasks/check-in/review sections", () => {
    const allOff = dashboardVisibilityFromActivations(activations({}));
    expect(allOff.currentChapter).toBe(true);
    expect(allOff.todaysHabits).toBe(false);
    expect(allOff.attentionTasks).toBe(false);
    expect(allOff.todaysCheckIn).toBe(false);
    expect(allOff.weeklyReview).toBe(false);

    const both = dashboardVisibilityFromActivations(
      activations({ habits: true, tasks: true, checkins: true, reviews: true }),
    );
    expect(both.todaysHabits).toBe(true);
    expect(both.attentionTasks).toBe(true);
    expect(both.todaysCheckIn).toBe(true);
    expect(both.weeklyReview).toBe(true);

    const habitsOnly = dashboardVisibilityFromActivations(activations({ habits: true }));
    expect(habitsOnly.todaysHabits).toBe(true);
    expect(habitsOnly.attentionTasks).toBe(false);
    expect(habitsOnly.todaysCheckIn).toBe(false);
    expect(habitsOnly.weeklyReview).toBe(false);
  });
});

describe("projectsWorkspaceFromActivations", () => {
  it("marks workspace inactive when projects/milestones/tasks are all off", () => {
    const workspace = projectsWorkspaceFromActivations(activations({ habits: true }));
    expect(workspace.workspaceActive).toBe(false);
    expect(workspace.canCreateProject).toBe(false);
    expect(workspace.canCreateMilestone).toBe(false);
    expect(workspace.canCreateTask).toBe(false);
    expect(workspace.canManageProjectStatus).toBe(false);
    expect(workspace.canManageMilestoneStatus).toBe(false);
    expect(workspace.canManageTaskStatus).toBe(false);
  });

  it("keeps partial workspace active with read-only controls for inactive types", () => {
    const workspace = projectsWorkspaceFromActivations(
      activations({ projects: true, tasks: false, milestones: false }),
    );
    expect(workspace.workspaceActive).toBe(true);
    expect(workspace.projectsActive).toBe(true);
    expect(workspace.milestonesActive).toBe(false);
    expect(workspace.tasksActive).toBe(false);
    expect(workspace.canCreateProject).toBe(true);
    expect(workspace.canManageProjectStatus).toBe(true);
    expect(workspace.canCreateMilestone).toBe(false);
    expect(workspace.canManageMilestoneStatus).toBe(false);
    expect(workspace.canCreateTask).toBe(false);
    expect(workspace.canManageTaskStatus).toBe(false);
  });

  it("enables full create and status management when all three are active", () => {
    const workspace = projectsWorkspaceFromActivations(
      activations({ projects: true, milestones: true, tasks: true }),
    );
    expect(workspace.workspaceActive).toBe(true);
    expect(workspace.canCreateProject).toBe(true);
    expect(workspace.canCreateMilestone).toBe(true);
    expect(workspace.canCreateTask).toBe(true);
    expect(workspace.canManageProjectStatus).toBe(true);
    expect(workspace.canManageMilestoneStatus).toBe(true);
    expect(workspace.canManageTaskStatus).toBe(true);
  });
});

describe("activation query failure handling", () => {
  it("preserves nav and dashboard visibility constants for failure fallback", () => {
    expect(PRESERVE_NAV_VISIBILITY).toEqual({
      dashboard: true,
      chapters: true,
      settings: true,
      habits: true,
      projects: true,
      checkins: true,
      reviews: true,
    });
    expect(PRESERVE_DASHBOARD_VISIBILITY).toEqual({
      currentChapter: true,
      todaysHabits: true,
      attentionTasks: true,
      todaysCheckIn: true,
      weeklyReview: true,
    });
    expect(PRESERVE_PROJECTS_GATING.workspaceActive).toBe(true);
    expect(PRESERVE_PROJECTS_GATING.canManageTaskStatus).toBe(true);
  });

  it("does not treat resolution failure as legitimate default-off", () => {
    const failed: ModuleGatingState = {
      status: "error",
      message: "Could not load modules.",
      chapterId: null,
      activations: null,
      nav: PRESERVE_NAV_VISIBILITY,
      dashboard: PRESERVE_DASHBOARD_VISIBILITY,
      projects: PRESERVE_PROJECTS_GATING,
      habitsActive: true,
      checkinsActive: true,
      reviewsActive: true,
      resolutionFailed: true,
    };
    expect(moduleActiveFromGating(failed, "habits")).toBe(true);
    expect(moduleActiveFromGating(failed, "tasks")).toBe(true);
    expect(moduleActiveFromGating(failed, "checkins")).toBe(true);
    expect(moduleActiveFromGating(failed, "reviews")).toBe(true);
    expect(failed.resolutionFailed).toBe(true);
    expect(failed.nav.habits).toBe(true);
    expect(failed.nav.projects).toBe(true);
    expect(failed.nav.checkins).toBe(true);
    expect(failed.nav.reviews).toBe(true);
  });

  it("treats explicit inactive activations as off only when resolution succeeded", () => {
    const ok: ModuleGatingState = {
      status: "ok",
      chapterId: null,
      activations: activations({}),
      nav: navVisibilityFromActivations(activations({})),
      dashboard: dashboardVisibilityFromActivations(activations({})),
      projects: projectsWorkspaceFromActivations(activations({})),
      habitsActive: false,
      checkinsActive: false,
      reviewsActive: false,
      resolutionFailed: false,
    };
    expect(moduleActiveFromGating(ok, "habits")).toBe(false);
    expect(moduleActiveFromGating(ok, "checkins")).toBe(false);
    expect(moduleActiveFromGating(ok, "reviews")).toBe(false);
    expect(ok.nav.habits).toBe(false);
    expect(ok.nav.checkins).toBe(false);
    expect(ok.nav.reviews).toBe(false);
    expect(ok.projects.workspaceActive).toBe(false);
  });
});

describe("navigation and dashboard reflect chapter resolution", () => {
  it("shows nav and dashboard from chapter override active over global inactive", () => {
    const resolved: ResolvedModuleActivation[] = MODULE_KEYS.map((moduleKey) => ({
      moduleKey,
      isActive: moduleKey === "habits" || moduleKey === "tasks",
      source: (moduleKey === "habits" || moduleKey === "tasks"
        ? "chapter"
        : "default_off") as ResolvedModuleActivation["source"],
    }));
    const nav = navVisibilityFromActivations(resolved);
    const dashboard = dashboardVisibilityFromActivations(resolved);
    expect(nav.habits).toBe(true);
    expect(nav.projects).toBe(true);
    expect(dashboard.todaysHabits).toBe(true);
    expect(dashboard.attentionTasks).toBe(true);
  });

  it("hides nav and dashboard when chapter override is inactive over global active", () => {
    const resolved: ResolvedModuleActivation[] = MODULE_KEYS.map((moduleKey) => ({
      moduleKey,
      isActive: false,
      source: (moduleKey === "habits" || moduleKey === "tasks"
        ? "chapter"
        : "default_off") as ResolvedModuleActivation["source"],
    }));
    const nav = navVisibilityFromActivations(resolved);
    const dashboard = dashboardVisibilityFromActivations(resolved);
    expect(nav.habits).toBe(false);
    expect(nav.projects).toBe(false);
    expect(dashboard.todaysHabits).toBe(false);
    expect(dashboard.attentionTasks).toBe(false);
  });
});
