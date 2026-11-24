import { CheckInForm } from "@/components/check-ins/check-in-form";
import type { CheckInRow } from "@/lib/db/types";

type CheckInHistoryProps = {
  rows: CheckInRow[];
  /** Civil day for "today" — today's row is edited via the main form, not listed twice. */
  todayOn: string;
};

export function CheckInHistory({ rows, todayOn }: CheckInHistoryProps) {
  const history = rows.filter((row) => row.checked_on !== todayOn);

  if (history.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No earlier check-ins yet. Past days appear here and stay editable.
      </p>
    );
  }

  return (
    <ul className="space-y-6">
      {history.map((row) => (
        <li
          key={row.id}
          className="space-y-3 border-b border-border pb-6 last:border-b-0 last:pb-0"
          data-checked-on={row.checked_on}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span className="font-medium text-foreground">{row.checked_on}</span>
            <span className="text-muted-foreground">
              mood {row.mood} · energy {row.energy} · focus {row.focus}
            </span>
          </div>
          {row.body ? (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{row.body}</p>
          ) : null}
          <CheckInForm
            mode="update"
            id={row.id}
            checkedOn={row.checked_on}
            defaults={{
              mood: row.mood,
              energy: row.energy,
              focus: row.focus,
              body: row.body,
            }}
          />
        </li>
      ))}
    </ul>
  );
}
