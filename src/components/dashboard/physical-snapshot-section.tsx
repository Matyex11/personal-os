import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { PhysicalMetricRow } from "@/lib/db/types";
import {
  PHYSICAL_METRIC_DEFS,
  type PhysicalMetricKey,
} from "@/modules/physical/schemas";

type PhysicalSnapshotSectionProps = {
  result:
    | {
        ok: true;
        data: {
          todayOn: string;
          timeZone: string;
          todayCount: number;
          latestByKey: Record<PhysicalMetricKey, PhysicalMetricRow | null>;
        };
      }
    | { ok: false; message: string }
    | null;
};

function formatLatest(row: PhysicalMetricRow | null, key: PhysicalMetricKey): string {
  if (!row) return "—";
  const def = PHYSICAL_METRIC_DEFS.find((item) => item.key === key)!;
  const value =
    def.kind === "integer" ? String(Math.trunc(Number(row.value))) : String(row.value);
  return `${value} ${row.unit} (${row.recorded_on})`;
}

export function PhysicalSnapshotSection({ result }: PhysicalSnapshotSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Physical snapshot</CardTitle>
        <CardDescription>
          {result?.ok
            ? `Latest saved measurements · today ${result.data.todayOn} (${result.data.timeZone}).`
            : "Latest saved measurements in your profile timezone."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!result ? (
          <p className="text-sm text-muted-foreground">Sign in to see physical metrics.</p>
        ) : !result.ok ? (
          <p className="text-sm text-muted-foreground">{result.message}</p>
        ) : (
          <ul className="space-y-1 text-sm text-foreground">
            {PHYSICAL_METRIC_DEFS.map((def) => (
              <li key={def.key}>
                <span className="text-muted-foreground">{def.label}: </span>
                {formatLatest(result.data.latestByKey[def.key], def.key)}
              </li>
            ))}
            <li className="pt-1 text-muted-foreground">
              Today:{" "}
              {result.data.todayCount === 0
                ? "no measurements yet"
                : `${result.data.todayCount} metric${result.data.todayCount === 1 ? "" : "s"} logged`}
            </li>
          </ul>
        )}
        <Button asChild variant="outline" size="sm">
          <Link href="/physical">
            {result?.ok && result.data.todayCount > 0 ? "Update today" : "Log measurements"}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
