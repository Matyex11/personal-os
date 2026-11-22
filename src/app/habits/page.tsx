import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createHabitAction, logHabitAction } from "@/app/actions/domain";
import { listHabitLogs, listHabits, reportHabitAdherence } from "@/modules/habits/service";

export const metadata = {
  title: "Habits",
};

export default async function HabitsPage() {
  const habits = await listHabits();
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 8)}01`;

  const firstHabit = habits.ok ? habits.data[0] : undefined;
  const logs = firstHabit ? await listHabitLogs(firstHabit.id) : null;
  const report = firstHabit
    ? await reportHabitAdherence({
        habitId: firstHabit.id,
        fromOn: monthStart,
        toOn: today,
      })
    : null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Habits"
        description="Cadence-driven expected days, five statuses, linked recovery, and dual adherence (target + minimum) with unlogged days exposed."
      />

      {!habits.ok ? (
        <EmptyState title="Habits unavailable" description={habits.message} />
      ) : habits.data.length === 0 ? (
        <EmptyState
          title="No habits yet"
          description="Create a habit with daily or weekday cadence. Persistence requires applied DEV migrations."
        />
      ) : (
        <div className="grid gap-3">
          {habits.data.map((habit) => (
            <Card key={habit.id}>
              <CardHeader>
                <CardTitle>{habit.name}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p>
                  min {habit.min_value} / target {habit.target_value}
                  {habit.unit ? ` ${habit.unit}` : ""} · cadence {JSON.stringify(habit.cadence)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {report?.ok ? (
        <Card>
          <CardHeader>
            <CardTitle>Adherence · {report.data.habit.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              Scheduled {report.data.summary.scheduledOccurrences} · completed{" "}
              {report.data.summary.completedCount} · partial {report.data.summary.partialCount} ·
              missed {report.data.summary.missedCount} · unlogged {report.data.summary.unloggedCount}
            </p>
            <p>
              Target attainment:{" "}
              {report.data.summary.targetAttainment === null
                ? "n/a"
                : `${Math.round(report.data.summary.targetAttainment * 100)}%`}
            </p>
            <p>
              Minimum adherence:{" "}
              {report.data.summary.minimumAdherence === null
                ? "n/a"
                : `${Math.round(report.data.summary.minimumAdherence * 100)}%`}
            </p>
            {report.data.summary.unloggedDates.length > 0 ? (
              <p className="text-muted-foreground">
                Unlogged: {report.data.summary.unloggedDates.join(", ")}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {firstHabit && logs?.ok ? (
        <Card>
          <CardHeader>
            <CardTitle>Recent logs · {firstHabit.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {logs.data.length === 0 ? (
              <p className="text-muted-foreground">No logs yet.</p>
            ) : (
              logs.data.map((log) => (
                <div key={log.id} className="flex justify-between gap-3 border-b border-border/60 py-2">
                  <span>
                    {log.logged_on} · {log.status}
                    {log.recovers_log_id ? ` · recovers ${log.recovers_log_id.slice(0, 8)}` : ""}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>New habit</CardTitle>
        </CardHeader>
        <CardContent>
          <ActionForm action={createHabitAction} submitLabel="Create habit" className="grid gap-3 sm:grid-cols-2">
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
              <Input id="targetValue" name="targetValue" type="number" defaultValue={1} min={0} step="any" />
            </Field>
          </ActionForm>
        </CardContent>
      </Card>

      {firstHabit ? (
        <Card>
          <CardHeader>
            <CardTitle>Log · {firstHabit.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={logHabitAction} submitLabel="Save log" className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="habitId" value={firstHabit.id} />
              <Field id="loggedOn" label="Date">
                <Input id="loggedOn" name="loggedOn" type="date" defaultValue={today} required />
              </Field>
              <Field id="status" label="Status">
                <select
                  id="status"
                  name="status"
                  defaultValue="completed"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="completed">completed</option>
                  <option value="partial">partial</option>
                  <option value="missed">missed</option>
                  <option value="not_scheduled">not_scheduled</option>
                  <option value="recovery">recovery</option>
                </select>
              </Field>
              <Field id="recoversLogId" label="Recovers log id (recovery only)">
                <Input id="recoversLogId" name="recoversLogId" placeholder="uuid" />
              </Field>
              <Field id="value" label="Value">
                <Input id="value" name="value" type="number" step="any" />
              </Field>
            </ActionForm>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
