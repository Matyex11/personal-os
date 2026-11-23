import { PageHeader } from "@/components/layout/page-header";
import { DisabledModuleState } from "@/components/modules/disabled-module-state";
import { EmptyState } from "@/components/states/empty-state";
import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HabitAdherenceReport } from "@/components/habits/habit-adherence-report";
import { HabitLogForm } from "@/components/habits/habit-log-form";
import { HabitLogHistory } from "@/components/habits/habit-log-history";
import { HabitReportRangeForm } from "@/components/habits/habit-report-range-form";
import { HabitSelector } from "@/components/habits/habit-selector";
import { createHabitAction } from "@/app/actions/domain";
import { monthStartOn, todayInTimeZone } from "@/lib/dates/calendar";
import { resolveHabitReportRangeQuery } from "@/modules/habits/report-range";
import {
  getProfileTimeZone,
  listHabitLogs,
  listHabitRecoveryTargets,
  listHabits,
  reportHabitAdherence,
} from "@/modules/habits/service";
import { selectEligibleHabits } from "@/modules/habits/recovery-targets";
import { getSessionModuleGating } from "@/modules/modules/gating";

export const metadata = {
  title: "Habits",
};

export default async function HabitsPage({
  searchParams,
}: {
  searchParams: Promise<{ habit?: string; from?: string; to?: string }>;
}) {
  const gating = await getSessionModuleGating();

  if (gating.status === "ok" && !gating.habitsActive) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Habits"
          description="Select a habit, choose a date range, log outcomes, and recover missed or partial history without rewriting originals."
        />
        <DisabledModuleState
          title="Habits module is inactive"
          description="Habits are turned off for the current chapter (or globally when no chapter is current). Activate the habits module from Chapters to use logging, recovery, and reporting. Existing habit data is kept — activation only controls availability."
        />
      </div>
    );
  }

  const params = await searchParams;
  const habitsResult = await listHabits();
  const timeZone = await getProfileTimeZone();
  const today = todayInTimeZone(timeZone);
  const defaultFrom = monthStartOn(today);
  const range = resolveHabitReportRangeQuery({
    from: params.from,
    to: params.to,
    todayOn: today,
    defaultFromOn: defaultFrom,
  });

  const eligible =
    habitsResult.ok ? selectEligibleHabits(habitsResult.data) : [];
  const selectedHabit =
    eligible.find((habit) => habit.id === params.habit) ?? eligible[0];

  const logs = selectedHabit ? await listHabitLogs(selectedHabit.id) : null;
  const recoveryTargets = selectedHabit
    ? await listHabitRecoveryTargets({ habitId: selectedHabit.id })
    : null;
  // Never call reporting with an invalid explicit/default-composed range.
  const report =
    selectedHabit && range.ok
      ? await reportHabitAdherence({
          habitId: selectedHabit.id,
          fromOn: range.fromOn,
          toOn: range.toOn,
        })
      : null;

  const rangeFrom = range.formFrom;
  const rangeTo = range.formTo;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Habits"
        description="Select a habit, choose a date range, log outcomes, and recover missed or partial history without rewriting originals."
      />

      {!habitsResult.ok ? (
        <EmptyState title="Habits unavailable" description={habitsResult.message} />
      ) : habitsResult.data.length === 0 ? (
        <EmptyState
          title="No habits yet"
          description="Create a habit with daily or weekday cadence, then log outcomes below."
        />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Habits</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <HabitSelector
                habits={eligible.map((habit) => ({
                  id: habit.id,
                  name: habit.name,
                  is_active: habit.is_active,
                }))}
                selectedHabitId={selectedHabit!.id}
                fromOn={rangeFrom}
                toOn={rangeTo}
              />
              <ul className="space-y-2 text-sm text-muted-foreground">
                {eligible.map((habit) => (
                  <li key={habit.id}>
                    <span
                      className={
                        habit.id === selectedHabit!.id
                          ? "font-medium text-foreground"
                          : ""
                      }
                    >
                      {habit.name}
                    </span>
                    {" · "}
                    min {habit.min_value} / target {habit.target_value}
                    {habit.unit ? ` ${habit.unit}` : ""}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {!range.ok ? (
            <Card>
              <CardHeader>
                <CardTitle>Reporting</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <EmptyState
                  title="Invalid date range"
                  description={`${range.message} Submitted: ${range.formFrom} → ${range.formTo}.`}
                />
                {selectedHabit ? (
                  <HabitReportRangeForm
                    habitId={selectedHabit.id}
                    fromOn={range.formFrom}
                    toOn={range.formTo}
                    maxOn={today}
                  />
                ) : null}
              </CardContent>
            </Card>
          ) : report?.ok ? (
            <Card>
              <CardHeader>
                <CardTitle>Reporting</CardTitle>
              </CardHeader>
              <CardContent>
                <HabitAdherenceReport
                  habitId={selectedHabit!.id}
                  habitName={report.data.habit.name}
                  fromOn={report.data.fromOn}
                  toOn={report.data.toOn}
                  todayOn={report.data.todayOn}
                  timeZone={report.data.timeZone}
                  summary={report.data.summary}
                />
              </CardContent>
            </Card>
          ) : report && !report.ok ? (
            <Card>
              <CardHeader>
                <CardTitle>Reporting</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <EmptyState title="Adherence unavailable" description={report.message} />
                {selectedHabit ? (
                  <HabitReportRangeForm
                    habitId={selectedHabit.id}
                    fromOn={range.formFrom}
                    toOn={range.formTo}
                    maxOn={today}
                  />
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {selectedHabit && logs?.ok ? (
            <Card>
              <CardHeader>
                <CardTitle>History</CardTitle>
              </CardHeader>
              <CardContent>
                <HabitLogHistory habitName={selectedHabit.name} logs={logs.data} />
              </CardContent>
            </Card>
          ) : logs && !logs.ok ? (
            <EmptyState title="Logs unavailable" description={logs.message} />
          ) : null}

          {selectedHabit && recoveryTargets?.ok ? (
            <Card>
              <CardHeader>
                <CardTitle>Log outcome</CardTitle>
              </CardHeader>
              <CardContent>
                <HabitLogForm
                  key={selectedHabit.id}
                  habitId={selectedHabit.id}
                  habitName={selectedHabit.name}
                  today={today}
                  initialTargets={recoveryTargets.data.items}
                  initialNextCursor={recoveryTargets.data.nextCursor}
                />
              </CardContent>
            </Card>
          ) : recoveryTargets && !recoveryTargets.ok ? (
            <EmptyState
              title="Recovery targets unavailable"
              description={recoveryTargets.message}
            />
          ) : null}
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>New habit</CardTitle>
        </CardHeader>
        <CardContent>
          <ActionForm
            action={createHabitAction}
            submitLabel="Create habit"
            className="grid gap-3 sm:grid-cols-2"
          >
            <Field id="name" label="Name">
              <Input id="name" name="name" required />
            </Field>
            <Field id="cadenceKind" label="Cadence">
              <select
                id="cadenceKind"
                name="cadenceKind"
                defaultValue="daily"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="daily">daily</option>
                <option value="weekdays">selected weekdays</option>
              </select>
            </Field>
            <Field id="weekdays" label="Weekdays (1=Mon…7=Sun, comma-separated)">
              <Input id="weekdays" name="weekdays" placeholder="1,2,3,4,5" />
            </Field>
            <Field id="startOn" label="Schedule start">
              <Input id="startOn" name="startOn" type="date" defaultValue={today} required />
            </Field>
            <Field id="minValue" label="Min">
              <Input id="minValue" name="minValue" type="number" defaultValue={1} min={0} step="any" />
            </Field>
            <Field id="targetValue" label="Target">
              <Input
                id="targetValue"
                name="targetValue"
                type="number"
                defaultValue={1}
                min={0}
                step="any"
              />
            </Field>
          </ActionForm>
        </CardContent>
      </Card>
    </div>
  );
}
