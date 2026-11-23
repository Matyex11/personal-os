import Link from "next/link";
import { AttentionTasksSection } from "@/components/dashboard/attention-tasks-section";
import { CurrentChapterSection } from "@/components/dashboard/current-chapter-section";
import { TodaysHabitsSection } from "@/components/dashboard/todays-habits-section";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";
import { getOptionalUser } from "@/lib/auth/require-user";
import {
  getDashboardAttentionTasks,
  getDashboardCurrentChapter,
  getDashboardTodaysHabits,
} from "@/modules/dashboard/service";

export default async function DashboardPage() {
  const user = await getOptionalUser();

  const chapter = user ? await getDashboardCurrentChapter() : null;
  const habits = user ? await getDashboardTodaysHabits() : null;
  const tasks = user ? await getDashboardAttentionTasks() : null;

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
          <AttentionTasksSection result={tasks} />
          <TodaysHabitsSection result={habits} />
        </div>
      )}
    </div>
  );
}
