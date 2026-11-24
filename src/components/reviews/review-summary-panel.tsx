import { formatPercent } from "@/lib/dates/calendar";
import type { WeeklyReviewSummary } from "@/modules/reviews/summary";

type ReviewSummaryPanelProps = {
  summary: WeeklyReviewSummary;
};

export function ReviewSummaryPanel({ summary }: ReviewSummaryPanelProps) {
  return (
    <div className="space-y-4 text-sm">
      <p className="text-muted-foreground">
        Facts for {summary.periodStart} → {summary.periodEnd} (computed on display, not
        stored).
      </p>

      <div>
        <h3 className="font-medium text-foreground">Check-ins</h3>
        {summary.checkIns.count === 0 ? (
          <p className="text-muted-foreground">No check-ins this week.</p>
        ) : (
          <p className="text-muted-foreground">
            {summary.checkIns.count} day
            {summary.checkIns.count === 1 ? "" : "s"} · mood avg{" "}
            {summary.checkIns.moodAvg ?? "—"} · energy avg{" "}
            {summary.checkIns.energyAvg ?? "—"} · focus avg{" "}
            {summary.checkIns.focusAvg ?? "—"}
          </p>
        )}
      </div>

      <div>
        <h3 className="font-medium text-foreground">Habits</h3>
        {summary.habits.length === 0 ? (
          <p className="text-muted-foreground">No active habits.</p>
        ) : (
          <ul className="mt-1 space-y-1 text-muted-foreground">
            {summary.habits.map((habit) => (
              <li key={habit.habitId}>
                {habit.habitName}: target {formatPercent(habit.targetAttainment)}, minimum{" "}
                {formatPercent(habit.minimumAdherence)} ({habit.completedCount} completed /{" "}
                {habit.scheduledOccurrences} scheduled)
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="font-medium text-foreground">Projects</h3>
        <p className="text-muted-foreground">
          active {summary.projects.active} · paused {summary.projects.paused} · done{" "}
          {summary.projects.done} · dropped {summary.projects.dropped}
        </p>
      </div>

      <div>
        <h3 className="font-medium text-foreground">Tasks</h3>
        <p className="text-muted-foreground">
          todo {summary.tasks.todo} · doing {summary.tasks.doing} · done {summary.tasks.done}{" "}
          · cancelled {summary.tasks.cancelled}
        </p>
      </div>
    </div>
  );
}
