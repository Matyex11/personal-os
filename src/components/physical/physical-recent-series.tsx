import type { PhysicalMetricRow } from "@/lib/db/types";
import {
  PHYSICAL_METRIC_DEFS,
  type PhysicalMetricKey,
} from "@/modules/physical/schemas";

type PhysicalRecentSeriesProps = {
  rows: PhysicalMetricRow[];
};

/**
 * Text-only recent values per metric — no chart library in this repo.
 * Newest first, up to 7 points.
 */
export function PhysicalRecentSeries({ rows }: PhysicalRecentSeriesProps) {
  const series = PHYSICAL_METRIC_DEFS.map((def) => {
    const points = rows
      .filter((row) => row.metric_key === def.key)
      .slice(0, 7)
      .map((row) => {
        const value =
          def.kind === "integer"
            ? String(Math.trunc(Number(row.value)))
            : String(row.value);
        return `${row.recorded_on}: ${value}`;
      });
    return { key: def.key as PhysicalMetricKey, label: def.label, unit: def.unit, points };
  }).filter((entry) => entry.points.length > 0);

  if (series.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Recent values will appear here after you save measurements.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {series.map((entry) => (
        <li key={entry.key} className="text-sm">
          <p className="font-medium text-foreground">
            {entry.label}{" "}
            <span className="font-normal text-muted-foreground">({entry.unit})</span>
          </p>
          <p className="text-muted-foreground">{entry.points.join(" → ")}</p>
        </li>
      ))}
    </ul>
  );
}
