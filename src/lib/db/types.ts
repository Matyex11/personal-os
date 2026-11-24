import type { HabitCadence } from "@/modules/habits/cadence";
import type {
  ChapterStatus,
  HabitLogStatus,
  MilestoneStatus,
  ModuleActivationScope,
  ModuleKey,
  ProjectStatus,
  TaskStatus,
} from "@/types/domain";

export type ProfileRow = {
  id: string;
  display_name: string | null;
  timezone: string;
  base_currency: string;
};

export type ChapterRow = {
  id: string;
  user_id: string;
  title: string;
  summary: string | null;
  started_on: string;
  ended_on: string | null;
  status: ChapterStatus;
  is_current: boolean;
};

export type ModuleActivationRow = {
  id: string;
  user_id: string;
  scope: ModuleActivationScope;
  chapter_id: string | null;
  module_key: ModuleKey;
  is_active: boolean;
  settings: Record<string, unknown>;
};

export type HabitRow = {
  id: string;
  user_id: string;
  chapter_id: string | null;
  name: string;
  description: string | null;
  cadence: HabitCadence;
  min_value: number;
  target_value: number;
  unit: string | null;
  is_active: boolean;
};

export type HabitLogRow = {
  id: string;
  user_id: string;
  habit_id: string;
  logged_on: string;
  status: HabitLogStatus;
  value: number | null;
  notes: string | null;
  recovers_log_id: string | null;
};

export type ProjectRow = {
  id: string;
  user_id: string;
  chapter_id: string | null;
  title: string;
  description: string | null;
  status: ProjectStatus;
  priority: number | null;
  target_date: string | null;
};

export type MilestoneRow = {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  status: MilestoneStatus;
  target_on: string | null;
  achieved_on: string | null;
};

export type TaskRow = {
  id: string;
  user_id: string;
  project_id: string | null;
  milestone_id: string | null;
  title: string;
  notes: string | null;
  status: TaskStatus;
  due_on: string | null;
  completed_at: string | null;
};

export type CheckInRow = {
  id: string;
  user_id: string;
  chapter_id: string | null;
  checked_on: string;
  mood: number;
  energy: number;
  focus: number;
  body: string | null;
  prompt_set_key: "v1_simple";
  created_at: string;
  updated_at: string;
};

export type ReviewPeriodKind = "weekly" | "monthly" | "chapter" | "custom";

export type ReviewStatus = "draft" | "completed";

export type ReviewRow = {
  id: string;
  user_id: string;
  chapter_id: string | null;
  period_kind: ReviewPeriodKind;
  period_start: string;
  period_end: string;
  status: ReviewStatus;
  answers: Record<string, unknown>;
  narrative: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};
