/** Shared domain types — no DB coupling in Phase 1A. */

export type ModuleKey =
  | "habits"
  | "tasks"
  | "projects"
  | "milestones"
  | "checkins"
  | "finances"
  | "physical"
  | "behavioural"
  | "reviews"
  | "xnine_tracking";

export type HabitLogStatus =
  | "completed"
  | "partial"
  | "missed"
  | "not_scheduled"
  | "recovery";

export type ChapterStatus = "planned" | "active" | "closed";

export type ProjectStatus = "active" | "paused" | "done" | "dropped";

export type MilestoneStatus = "pending" | "hit" | "missed" | "cancelled";

export type TaskStatus = "todo" | "doing" | "done" | "cancelled";

export type ModuleActivationScope = "global" | "chapter";

export type Chapter = {
  id: string;
  userId: string;
  title: string;
  summary?: string;
  status: ChapterStatus;
  isCurrent: boolean;
  startedOn: string;
  endedOn?: string | null;
};

export type Habit = {
  id: string;
  userId: string;
  chapterId?: string | null;
  name: string;
  description?: string;
  minValue: number;
  targetValue: number;
  unit?: string;
  isActive: boolean;
};

export type HabitLog = {
  id: string;
  userId: string;
  habitId: string;
  loggedOn: string;
  status: HabitLogStatus;
  value?: number | null;
  notes?: string;
  recoversLogId?: string | null;
};

export type Project = {
  id: string;
  userId: string;
  chapterId?: string | null;
  title: string;
  description?: string;
  status: ProjectStatus;
  priority?: number;
  targetDate?: string | null;
};

export type Milestone = {
  id: string;
  userId: string;
  projectId?: string | null;
  title: string;
  description?: string;
  status: MilestoneStatus;
  targetOn?: string | null;
  achievedOn?: string | null;
};

export type Task = {
  id: string;
  userId: string;
  projectId?: string | null;
  milestoneId?: string | null;
  title: string;
  notes?: string;
  status: TaskStatus;
  dueOn?: string | null;
  completedAt?: string | null;
};

export type CheckIn = {
  id: string;
  userId: string;
  chapterId?: string | null;
  checkedOn: string;
  mood: number;
  energy: number;
  focus: number;
  body?: string | null;
  promptSetKey: "v1_simple";
};

export type ReviewStatus = "draft" | "completed";

export type ReviewPeriodKind = "weekly" | "monthly" | "chapter" | "custom";

export type WeeklyReviewAnswers = {
  wentWell?: string;
  didNotGoWell?: string;
  learned?: string;
  mattersNext?: string;
};

export type Review = {
  id: string;
  userId: string;
  chapterId?: string | null;
  periodKind: ReviewPeriodKind;
  periodStart: string;
  periodEnd: string;
  status: ReviewStatus;
  answers: WeeklyReviewAnswers;
  narrative?: string | null;
  completedAt?: string | null;
};
