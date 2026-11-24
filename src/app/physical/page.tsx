import { PhysicalDatePicker } from "@/components/physical/physical-date-picker";
import { PhysicalDayForm } from "@/components/physical/physical-day-form";
import { PhysicalHistory } from "@/components/physical/physical-history";
import { PhysicalRecentSeries } from "@/components/physical/physical-recent-series";
import { PageHeader } from "@/components/layout/page-header";
import { DisabledModuleState } from "@/components/modules/disabled-module-state";
import { EmptyState } from "@/components/states/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { todayInTimeZone } from "@/lib/dates/calendar";
import { isoDateSchema } from "@/lib/validation/common";
import { getSessionModuleGating } from "@/modules/modules/gating";
import {
  getPhysicalMetricsForDay,
  getProfileTimeZone,
  listPhysicalMetrics,
} from "@/modules/physical/service";
import type { PhysicalMetricKey } from "@/modules/physical/schemas";

export const metadata = {
  title: "Physical",
};

type PhysicalPageProps = {
  searchParams: Promise<{ on?: string }>;
};

export default async function PhysicalPage({ searchParams }: PhysicalPageProps) {
  const gating = await getSessionModuleGating();

  if (gating.status === "ok" && !gating.physicalActive) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Physical"
          description="Track weight, sleep, steps, resting heart rate, and workout minutes — self-reported, not medical advice."
        />
        <DisabledModuleState
          title="Physical module is inactive"
          description="Physical metrics are turned off for the current chapter (or globally when no chapter is current). Activate the physical module from Chapters to record measurements. Existing rows are kept — activation only controls availability."
        />
      </div>
    );
  }

  const timeZone = await getProfileTimeZone();
  const todayOn = todayInTimeZone(timeZone);
  const params = await searchParams;
  const requestedOn = params.on?.trim() ?? "";
  const parsedOn = isoDateSchema.safeParse(requestedOn);
  const selectedOn =
    parsedOn.success && parsedOn.data <= todayOn ? parsedOn.data : todayOn;

  const dayResult = await getPhysicalMetricsForDay(selectedOn);
  const list = await listPhysicalMetrics({ limit: 200 });

  const defaults =
    dayResult.ok
      ? Object.fromEntries(
          dayResult.data.map((row) => [
            row.metric_key as PhysicalMetricKey,
            { value: Number(row.value), notes: row.notes },
          ]),
        )
      : undefined;

  const isToday = selectedOn === todayOn;
  const hasAny = dayResult.ok && dayResult.data.length > 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Physical"
        description="One value per metric per civil day in your profile timezone. Save any subset; past days stay editable; nothing is deleted. Not medical or wearable advice."
      />

      {!dayResult.ok ? (
        <EmptyState title="Physical metrics unavailable" description={dayResult.message} />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>
                {isToday
                  ? hasAny
                    ? `Today (${todayOn})`
                    : `Log today (${todayOn})`
                  : `Edit ${selectedOn}`}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <PhysicalDatePicker todayOn={todayOn} selectedOn={selectedOn} />
              <PhysicalDayForm
                key={`day-${selectedOn}`}
                recordedOn={selectedOn}
                defaults={defaults}
                submitLabel={hasAny ? "Update measurements" : "Save measurements"}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent values</CardTitle>
            </CardHeader>
            <CardContent>
              {!list.ok ? (
                <p className="text-sm text-muted-foreground">{list.message}</p>
              ) : (
                <PhysicalRecentSeries rows={list.data} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>History</CardTitle>
            </CardHeader>
            <CardContent>
              {!list.ok ? (
                <p className="text-sm text-muted-foreground">{list.message}</p>
              ) : (
                <PhysicalHistory rows={list.data} activeOn={selectedOn} />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
