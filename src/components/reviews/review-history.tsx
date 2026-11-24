import type { mapReviewRow } from "@/modules/reviews/service";

type MappedReview = ReturnType<typeof mapReviewRow>;

type ReviewHistoryProps = {
  rows: MappedReview[];
  currentPeriodStart: string;
};

export function ReviewHistory({ rows, currentPeriodStart }: ReviewHistoryProps) {
  const history = rows.filter((row) => row.periodStart !== currentPeriodStart);

  if (history.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No earlier weekly reviews yet. Completed weeks appear here.
      </p>
    );
  }

  return (
    <ul className="space-y-4">
      {history.map((row) => (
        <li
          key={row.id}
          className="border-b border-border pb-4 last:border-b-0 last:pb-0"
          data-period-start={row.periodStart}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span className="font-medium text-foreground">
              {row.periodStart} → {row.periodEnd}
            </span>
            <span className="text-muted-foreground">
              {row.status === "completed" ? "completed" : "draft"}
              {row.completedAt ? ` · ${row.completedAt}` : ""}
            </span>
          </div>
          {row.status === "completed" ? (
            <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
              {row.answers.wentWell ||
                row.answers.mattersNext ||
                row.answers.learned ||
                row.answers.didNotGoWell ||
                "No answers recorded."}
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Draft — open current week to edit only if it is this week; older drafts stay listed.</p>
          )}
        </li>
      ))}
    </ul>
  );
}
