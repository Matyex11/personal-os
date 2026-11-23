import { formatPercent } from "@/lib/dates/calendar";
import type { AdherenceSummary } from "@/modules/habits/reporting";
import { HabitReportRangeForm } from "@/components/habits/habit-report-range-form";

const UNLOGGED_PREVIEW = 14;

type HabitAdherenceReportProps = {
  habitId: string;
  habitName: string;
  fromOn: string;
  toOn: string;
  todayOn: string;
  timeZone: string;
  summary: AdherenceSummary;
};

export function HabitAdherenceReport({
  habitId,
  habitName,
  fromOn,
  toOn,
  todayOn,
  timeZone,
  summary,
}: HabitAdherenceReportProps) {
  const denom = summary.scheduledOccurrences;
  const unlogged = summary.unloggedDates;
  const preview = unlogged.slice(0, UNLOGGED_PREVIEW);
  const rest = unlogged.slice(UNLOGGED_PREVIEW);

  return (
    <div className="space-y-4 text-sm">
      <div>
        <p className="font-medium text-foreground">Adherence · {habitName}</p>
        <p className="text-muted-foreground">
          {fromOn} → {toOn} · calendar days in {timeZone}
        </p>
      </div>

      <HabitReportRangeForm
        habitId={habitId}
        fromOn={fromOn}
        toOn={toOn}
        maxOn={todayOn}
      />

      {denom === 0 ? (
        <div className="space-y-1" role="status">
          <p>
            Target attainment: <span className="font-medium">N/A</span>
          </p>
          <p>
            Minimum adherence: <span className="font-medium">N/A</span>
          </p>
          <p className="text-muted-foreground">
            No scheduled occurrences in this range, so rates are not applicable
            (not 0%).
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <p>
            Target attainment:{" "}
            <span className="font-medium">{formatPercent(summary.targetAttainment)}</span>
            <span className="text-muted-foreground">
              {" "}
              · completed ÷ scheduled ({summary.completedCount} / {denom})
            </span>
          </p>
          <p>
            Minimum adherence:{" "}
            <span className="font-medium">{formatPercent(summary.minimumAdherence)}</span>
            <span className="text-muted-foreground">
              {" "}
              · (completed + partial) ÷ scheduled (
              {summary.completedCount + summary.partialCount} / {denom})
            </span>
          </p>
        </div>
      )}

      <p>
        Counts (denominator = scheduled): scheduled {denom} · completed{" "}
        {summary.completedCount} · partial {summary.partialCount} · missed{" "}
        {summary.missedCount} · unlogged {summary.unloggedCount}
      </p>
      <p className="text-muted-foreground">
        Missed and unlogged count in the denominator with 0 credit.{" "}
        <code className="text-xs">not_scheduled</code> and{" "}
        <code className="text-xs">recovery</code> are excluded from the
        denominator. Recovery never rewrites history.
      </p>

      <div>
        <p className="font-medium text-foreground">Unlogged scheduled dates</p>
        {unlogged.length === 0 ? (
          <p className="text-muted-foreground" role="status">
            None — every scheduled day in range has a primary outcome.
          </p>
        ) : unlogged.length <= UNLOGGED_PREVIEW ? (
          <p className="text-muted-foreground">{unlogged.join(", ")}</p>
        ) : (
          <details>
            <summary className="cursor-pointer text-muted-foreground">
              {unlogged.length} dates · showing first {UNLOGGED_PREVIEW} (expand
              for all)
            </summary>
            <p className="mt-2 text-muted-foreground">
              {preview.join(", ")}
              {rest.length > 0 ? `, ${rest.join(", ")}` : ""}
            </p>
          </details>
        )}
      </div>
    </div>
  );
}
