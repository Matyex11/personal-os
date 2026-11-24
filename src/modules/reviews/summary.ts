/**
 * Read-only weekly review summary helpers — no DB writes.
 * Aggregates are computed at display time from habits / projects / check-ins.
 */

export type HabitAdherenceSlice = {
  habitId: string;
  habitName: string;
  scheduledOccurrences: number;
  completedCount: number;
  partialCount: number;
  missedCount: number;
  unloggedCount: number;
  targetAttainment: number | null;
  minimumAdherence: number | null;
};

export type ProjectStatusCounts = {
  active: number;
  paused: number;
  done: number;
  dropped: number;
};

export type TaskStatusCounts = {
  todo: number;
  doing: number;
  done: number;
  cancelled: number;
};

export type CheckInAverages = {
  count: number;
  moodAvg: number | null;
  energyAvg: number | null;
  focusAvg: number | null;
};

export type WeeklyReviewSummary = {
  periodStart: string;
  periodEnd: string;
  habits: HabitAdherenceSlice[];
  projects: ProjectStatusCounts;
  tasks: TaskStatusCounts;
  checkIns: CheckInAverages;
};

export type CheckInScoreRow = {
  checkedOn: string;
  mood: number;
  energy: number;
  focus: number;
};

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((acc, value) => acc + value, 0);
  return Math.round((sum / values.length) * 100) / 100;
}

export function averageCheckInScores(rows: CheckInScoreRow[]): CheckInAverages {
  return {
    count: rows.length,
    moodAvg: average(rows.map((row) => row.mood)),
    energyAvg: average(rows.map((row) => row.energy)),
    focusAvg: average(rows.map((row) => row.focus)),
  };
}

export function countProjectStatuses(
  rows: Array<{ status: string }>,
): ProjectStatusCounts {
  const counts: ProjectStatusCounts = { active: 0, paused: 0, done: 0, dropped: 0 };
  for (const row of rows) {
    if (row.status === "active") counts.active += 1;
    else if (row.status === "paused") counts.paused += 1;
    else if (row.status === "done") counts.done += 1;
    else if (row.status === "dropped") counts.dropped += 1;
  }
  return counts;
}

export function countTaskStatuses(rows: Array<{ status: string }>): TaskStatusCounts {
  const counts: TaskStatusCounts = { todo: 0, doing: 0, done: 0, cancelled: 0 };
  for (const row of rows) {
    if (row.status === "todo") counts.todo += 1;
    else if (row.status === "doing") counts.doing += 1;
    else if (row.status === "done") counts.done += 1;
    else if (row.status === "cancelled") counts.cancelled += 1;
  }
  return counts;
}

export function buildWeeklyReviewSummary(input: {
  periodStart: string;
  periodEnd: string;
  habits: HabitAdherenceSlice[];
  projects: Array<{ status: string }>;
  tasks: Array<{ status: string }>;
  checkIns: CheckInScoreRow[];
}): WeeklyReviewSummary {
  return {
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    habits: input.habits,
    projects: countProjectStatuses(input.projects),
    tasks: countTaskStatuses(input.tasks),
    checkIns: averageCheckInScores(input.checkIns),
  };
}
