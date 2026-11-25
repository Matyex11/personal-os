import Link from "next/link";
import type { PhysicalMetricRow } from "@/lib/db/types";
import { physicalMetricDef, type PhysicalMetricKey } from "@/modules/physical/schemas";

type PhysicalHistoryProps = {
  rows: PhysicalMetricRow[];
  /** Civil day currently shown in the editor — omit from history list. */
  activeOn: string;
};

function formatValue(row: PhysicalMetricRow): string {
  const def = physicalMetricDef(row.metric_key as PhysicalMetricKey);
  const value =
    def.kind === "integer" ? String(Math.trunc(Number(row.value))) : String(row.value);
  return `${def.label} ${value} ${row.unit}`;
}

export function PhysicalHistory({ rows, activeOn }: PhysicalHistoryProps) {
  const byDate = new Map<string, PhysicalMetricRow[]>();
  for (const row of rows) {
    if (row.recorded_on === activeOn) continue;
    const list = byDate.get(row.recorded_on) ?? [];
    list.push(row);
    byDate.set(row.recorded_on, list);
  }

  const dates = [...byDate.keys()].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));

  if (dates.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No earlier measurements yet. Past days appear here; pick a date above to edit.
      </p>
    );
  }

  return (
    <ul className="space-y-4">
      {dates.map((date) => {
        const dayRows = byDate.get(date) ?? [];
        return (
          <li
            key={date}
            className="space-y-1 border-b border-border pb-4 last:border-b-0 last:pb-0"
            data-recorded-on={date}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <Link
                href={`/physical?on=${encodeURIComponent(date)}`}
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                {date}
              </Link>
              <span className="text-muted-foreground">
                {dayRows.length} metric{dayRows.length === 1 ? "" : "s"}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {dayRows.map(formatValue).join(" · ")}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
