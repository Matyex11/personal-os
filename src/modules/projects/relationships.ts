/**
 * Resolve task parent links for create.
 * - Milestone alone → derive project from milestone when present.
 * - Project + milestone → milestone must belong to that project.
 * Pure; callers must pass owned rows only.
 */
export function resolveTaskParents(input: {
  projectId?: string | null;
  milestoneId?: string | null;
  milestone: { id: string; project_id: string | null } | null;
}):
  | { ok: true; projectId: string | null; milestoneId: string | null }
  | { ok: false; message: string } {
  const projectId = input.projectId ?? null;
  const milestoneId = input.milestoneId ?? null;

  if (!milestoneId) {
    return { ok: true, projectId, milestoneId: null };
  }

  if (!input.milestone || input.milestone.id !== milestoneId) {
    return { ok: false, message: "Milestone not found." };
  }

  const milestoneProjectId = input.milestone.project_id;

  if (projectId && milestoneProjectId && projectId !== milestoneProjectId) {
    return {
      ok: false,
      message: "Milestone does not belong to the selected project.",
    };
  }

  if (projectId && !milestoneProjectId) {
    return {
      ok: false,
      message: "Milestone does not belong to the selected project.",
    };
  }

  return {
    ok: true,
    projectId: projectId ?? milestoneProjectId,
    milestoneId,
  };
}

export type HierarchyTask = {
  id: string;
  title: string;
  status: string;
  due_on: string | null;
  completed_at: string | null;
  project_id: string | null;
  milestone_id: string | null;
};

export type HierarchyMilestone = {
  id: string;
  title: string;
  status: string;
  target_on: string | null;
  achieved_on: string | null;
  project_id: string | null;
  tasks: HierarchyTask[];
};

export type HierarchyProject = {
  id: string;
  title: string;
  status: string;
  target_date: string | null;
  milestones: HierarchyMilestone[];
  directTasks: HierarchyTask[];
  /** Tasks under project (direct + via milestones), unique by id. Conflicts excluded. */
  taskTotal: number;
  taskDone: number;
};

export type HierarchyRelationshipConflict = {
  task: HierarchyTask;
  reason: "project_mismatch" | "unresolved_milestone";
  milestone: { id: string; title: string; project_id: string | null } | null;
  /** Project the task row points at (null if unset / unknown). */
  taskProject: { id: string; title: string } | null;
  /** Project the milestone row points at (null if unset / unknown / unresolved). */
  milestoneProject: { id: string; title: string } | null;
};

export type ProjectHierarchy = {
  projects: HierarchyProject[];
  standaloneMilestones: HierarchyMilestone[];
  inboxTasks: HierarchyTask[];
  relationshipConflicts: HierarchyRelationshipConflict[];
};

function projectRef(
  projectsById: Map<string, { id: string; title: string }>,
  projectId: string | null,
): { id: string; title: string } | null {
  if (!projectId) return null;
  return projectsById.get(projectId) ?? { id: projectId, title: "(unknown project)" };
}

/**
 * Build Project → Milestone → Task tree without duplicating tasks.
 * Milestone-linked tasks appear only under their milestone when project links match.
 * Mismatched or unresolved milestone links → relationshipConflicts (visible, not nested).
 * Project-only tasks appear under the project.
 * Unassigned tasks → inbox; milestones without project → standalone.
 */
export function buildProjectHierarchy(input: {
  projects: Array<{
    id: string;
    title: string;
    status: string;
    target_date: string | null;
  }>;
  milestones: Array<{
    id: string;
    title: string;
    status: string;
    target_on: string | null;
    achieved_on: string | null;
    project_id: string | null;
  }>;
  tasks: HierarchyTask[];
}): ProjectHierarchy {
  const placedTaskIds = new Set<string>();
  const relationshipConflicts: HierarchyRelationshipConflict[] = [];

  const projectsById = new Map(
    input.projects.map((project) => [project.id, { id: project.id, title: project.title }]),
  );
  const milestonesById = new Map(input.milestones.map((milestone) => [milestone.id, milestone]));

  const consistentTasksByMilestone = new Map<string, HierarchyTask[]>();

  for (const task of input.tasks) {
    if (!task.milestone_id) continue;

    const milestone = milestonesById.get(task.milestone_id);
    if (!milestone) {
      relationshipConflicts.push({
        task,
        reason: "unresolved_milestone",
        milestone: null,
        taskProject: projectRef(projectsById, task.project_id),
        milestoneProject: null,
      });
      placedTaskIds.add(task.id);
      continue;
    }

    const taskProjectId = task.project_id ?? null;
    const milestoneProjectId = milestone.project_id ?? null;
    if (taskProjectId !== milestoneProjectId) {
      relationshipConflicts.push({
        task,
        reason: "project_mismatch",
        milestone: {
          id: milestone.id,
          title: milestone.title,
          project_id: milestone.project_id,
        },
        taskProject: projectRef(projectsById, taskProjectId),
        milestoneProject: projectRef(projectsById, milestoneProjectId),
      });
      placedTaskIds.add(task.id);
      continue;
    }

    const list = consistentTasksByMilestone.get(milestone.id) ?? [];
    list.push(task);
    consistentTasksByMilestone.set(milestone.id, list);
    placedTaskIds.add(task.id);
  }

  const milestonesByProject = new Map<string, HierarchyMilestone[]>();
  const standaloneMilestones: HierarchyMilestone[] = [];

  for (const milestone of input.milestones) {
    const tasks = consistentTasksByMilestone.get(milestone.id) ?? [];
    const node: HierarchyMilestone = { ...milestone, tasks };
    if (milestone.project_id) {
      const list = milestonesByProject.get(milestone.project_id) ?? [];
      list.push(node);
      milestonesByProject.set(milestone.project_id, list);
    } else {
      standaloneMilestones.push(node);
    }
  }

  const projects: HierarchyProject[] = input.projects.map((project) => {
    const milestones = milestonesByProject.get(project.id) ?? [];
    const directTasks = input.tasks.filter(
      (task) =>
        task.project_id === project.id &&
        !task.milestone_id &&
        !placedTaskIds.has(task.id),
    );
    for (const task of directTasks) placedTaskIds.add(task.id);

    const allTasks = [
      ...directTasks,
      ...milestones.flatMap((milestone) => milestone.tasks),
    ];
    const unique = new Map(allTasks.map((task) => [task.id, task]));
    const uniqueTasks = [...unique.values()];

    return {
      ...project,
      milestones,
      directTasks,
      taskTotal: uniqueTasks.length,
      taskDone: uniqueTasks.filter((task) => task.status === "done").length,
    };
  });

  const inboxTasks = input.tasks.filter(
    (task) => !task.project_id && !task.milestone_id && !placedTaskIds.has(task.id),
  );
  for (const task of inboxTasks) placedTaskIds.add(task.id);

  return { projects, standaloneMilestones, inboxTasks, relationshipConflicts };
}
