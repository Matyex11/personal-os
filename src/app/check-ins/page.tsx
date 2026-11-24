import { CheckInForm } from "@/components/check-ins/check-in-form";
import { CheckInHistory } from "@/components/check-ins/check-in-history";
import { PageHeader } from "@/components/layout/page-header";
import { DisabledModuleState } from "@/components/modules/disabled-module-state";
import { EmptyState } from "@/components/states/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { todayInTimeZone } from "@/lib/dates/calendar";
import {
  getProfileTimeZone,
  listCheckIns,
} from "@/modules/checkins/service";
import { getSessionModuleGating } from "@/modules/modules/gating";

export const metadata = {
  title: "Check-ins",
};

export default async function CheckInsPage() {
  const gating = await getSessionModuleGating();

  if (gating.status === "ok" && !gating.checkinsActive) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Check-ins"
          description="One mood, energy, and focus check-in per civil day in your profile timezone."
        />
        <DisabledModuleState
          title="Check-ins module is inactive"
          description="Check-ins are turned off for the current chapter (or globally when no chapter is current). Activate the checkins module from Chapters to record today and edit history. Existing check-ins are kept — activation only controls availability."
        />
      </div>
    );
  }

  const timeZone = await getProfileTimeZone();
  const todayOn = todayInTimeZone(timeZone);
  const list = await listCheckIns({ limit: 60 });
  const todayRow =
    list.ok ? list.data.find((row) => row.checked_on === todayOn) ?? null : null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Check-ins"
        description="One mood, energy, and focus check-in per civil day in your profile timezone. Past days stay editable; nothing is deleted."
      />

      {!list.ok ? (
        <EmptyState title="Check-ins unavailable" description={list.message} />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>
                {todayRow ? `Today (${todayOn})` : `Check in for ${todayOn}`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CheckInForm
                key={`today-${todayOn}`}
                mode="upsert"
                checkedOn={todayOn}
                defaults={
                  todayRow
                    ? {
                        mood: todayRow.mood,
                        energy: todayRow.energy,
                        focus: todayRow.focus,
                        body: todayRow.body,
                      }
                    : undefined
                }
                submitLabel={todayRow ? "Update today" : "Save check-in"}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>History</CardTitle>
            </CardHeader>
            <CardContent>
              <CheckInHistory rows={list.data} todayOn={todayOn} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
