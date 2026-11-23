import { addCalendarDays } from "@/lib/dates/calendar";

export type AttentionTaskInput = {
  id: string;
  title: string;
  status: string;
  due_on: string | null;
  project_id: string | null;
  milestone_id: string | null;
};

export type AttentionTaskRow = {
  id: string;
  title: string;
  status: "todo" | "doing";
  dueOn: string;
  overdue: boolean;
  projectTitle: string | null;
  milestoneTitle: string | null;
};

const OPEN_STATUSES = new Set(["todo", "doing"]);

/**
 * Open tasks that are overdue or due on/before today+7 (inclusive).
 * Excludes done/cancelled and tasks without a due date.
 * Sorted by due date ascending (overdue first).
 */
export function selectAttentionTasks(input: {
  tasks: AttentionTaskInput[];
  todayOn: string;
  projects: Array<{ id: string; title: string }>;
  milestones: Array<{ id: string; title: string }>;
  /** Inclusive horizon in calendar days from today (default 7). */
  withinDays?: number;
}): AttentionTaskRow[] {
  const withinDays = input.withinDays ?? 7;
  const horizon = addCalendarDays(input.todayOn, withinDays);
  const projectsById = new Map(input.projects.map((p) => [p.id, p.title]));
  const milestonesById = new Map(input.milestones.map((m) => [m.id, m.title]));

  const rows: AttentionTaskRow[] = [];

  for (const task of input.tasks) {
    if (!OPEN_STATUSES.has(task.status)) continue;
    if (!task.due_on) continue;
    if (task.due_on > horizon) continue;

    rows.push({
      id: task.id,
      title: task.title,
      status: task.status as "todo" | "doing",
      dueOn: task.due_on,
      overdue: task.due_on < input.todayOn,
      projectTitle: task.project_id
        ? (projectsById.get(task.project_id) ?? null)
        : null,
      milestoneTitle: task.milestone_id
        ? (milestonesById.get(task.milestone_id) ?? null)
        : null,
    });
  }

  rows.sort((a, b) => {
    if (a.dueOn !== b.dueOn) return a.dueOn < b.dueOn ? -1 : 1;
    return a.title.localeCompare(b.title);
  });

  return rows;
}
