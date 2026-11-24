import Link from "next/link";
import { AttentionTasksSection } from "@/components/dashboard/attention-tasks-section";
import { CurrentChapterSection } from "@/components/dashboard/current-chapter-section";
import { TodaysCheckInSection } from "@/components/dashboard/todays-check-in-section";
import { TodaysHabitsSection } from "@/components/dashboard/todays-habits-section";
import { WeeklyReviewSection } from "@/components/dashboard/weekly-review-section";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";
import { getOptionalUser } from "@/lib/auth/require-user";
import { getTodaysCheckInStatus } from "@/modules/checkins/service";
import {
  getDashboardAttentionTasks,
  getDashboardCurrentChapter,
  getDashboardTodaysHabits,
} from "@/modules/dashboard/service";
import { getSessionModuleGating } from "@/modules/modules/gating";
import { getCurrentWeekReviewStatus } from "@/modules/reviews/service";

export default async function DashboardPage() {
  const user = await getOptionalUser();
  const gating = user ? await getSessionModuleGating() : null;

  const showHabits = gating ? gating.dashboard.todaysHabits : true;
  const showTasks = gating ? gating.dashboard.attentionTasks : true;
  const showCheckIn = gating ? gating.dashboard.todaysCheckIn : true;
  const showWeeklyReview = gating ? gating.dashboard.weeklyReview : true;

  const chapter = user ? await getDashboardCurrentChapter() : null;
  const habits = user && showHabits ? await getDashboardTodaysHabits() : null;
  const tasks = user && showTasks ? await getDashboardAttentionTasks() : null;
  const checkIn = user && showCheckIn ? await getTodaysCheckInStatus() : null;
  const weeklyReview =
    user && showWeeklyReview ? await getCurrentWeekReviewStatus() : null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Where am I, what needs attention, and how today is going — live rows, not counts."
      />

      {!user ? (
        <EmptyState
          title="Sign in to continue"
          description="Protected routes require a magic-link session against personal-os-dev."
          action={
            <Button asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <CurrentChapterSection result={chapter} />
          {showTasks ? <AttentionTasksSection result={tasks} /> : null}
          {showHabits ? <TodaysHabitsSection result={habits} /> : null}
          {showCheckIn ? <TodaysCheckInSection result={checkIn} /> : null}
          {showWeeklyReview ? <WeeklyReviewSection result={weeklyReview} /> : null}
        </div>
      )}
    </div>
  );
}
