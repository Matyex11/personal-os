"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/forms/field";
import { Input } from "@/components/ui/input";
import {
  listHabitRecoveryTargetsAction,
  logHabitAction,
} from "@/app/actions/domain";
import {
  formatRecoveryTargetLabel,
  type EligibleRecoveryTarget,
} from "@/modules/habits/recovery-targets";

type HabitLogFormProps = {
  habitId: string;
  habitName: string;
  today: string;
  initialTargets: EligibleRecoveryTarget[];
  initialNextCursor: string | null;
};

const STATUSES = [
  "completed",
  "partial",
  "missed",
  "not_scheduled",
  "recovery",
] as const;

export function HabitLogForm({
  habitId,
  habitName,
  today,
  initialTargets,
  initialNextCursor,
}: HabitLogFormProps) {
  const router = useRouter();
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("completed");
  const [recoversLogId, setRecoversLogId] = useState("");
  const [targets, setTargets] = useState(initialTargets);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [pending, startTransition] = useTransition();
  const [loadingOlder, startLoadOlder] = useTransition();
  const [refreshingTargets, startRefreshTargets] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function refreshTargetsFromServer() {
    startRefreshTargets(async () => {
      const result = await listHabitRecoveryTargetsAction({ habitId, cursor: null });
      if (result.ok) {
        setTargets(result.data.items);
        setNextCursor(result.data.nextCursor);
        setRecoversLogId((current) =>
          result.data.items.some((row) => row.id === current) ? current : "",
        );
      }
    });
  }

  function loadOlder() {
    if (!nextCursor || loadingOlder) return;
    startLoadOlder(async () => {
      const result = await listHabitRecoveryTargetsAction({
        habitId,
        cursor: nextCursor,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setTargets((prev) => {
        const seen = new Set(prev.map((row) => row.id));
        const appended = result.data.items.filter((row) => !seen.has(row.id));
        return [...prev, ...appended];
      });
      setNextCursor(result.data.nextCursor);
    });
  }

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);
        formData.set("habitId", habitId);
        formData.set("status", status);
        if (status === "recovery") {
          if (!recoversLogId) {
            setError("Choose a missed or partial log to recover.");
            setMessage(null);
            return;
          }
          formData.set("recoversLogId", recoversLogId);
        } else {
          formData.delete("recoversLogId");
        }

        setMessage(null);
        setError(null);
        startTransition(async () => {
          const result = await logHabitAction(formData);
          if (result.ok) {
            setMessage("Log saved.");
            const recoveredId = recoversLogId;
            setRecoversLogId("");
            setStatus("completed");
            form.reset();
            const dateInput = form.elements.namedItem("loggedOn");
            if (dateInput instanceof HTMLInputElement) {
              dateInput.value = today;
            }
            if (recoveredId) {
              setTargets((prev) => prev.filter((row) => row.id !== recoveredId));
            }
            refreshTargetsFromServer();
            router.refresh();
          } else {
            setError(result.message);
          }
        });
      }}
    >
      <p className="sm:col-span-2 text-sm text-muted-foreground">
        Logging for <span className="font-medium text-foreground">{habitName}</span>
      </p>

      <Field id="loggedOn" label="Date">
        <Input id="loggedOn" name="loggedOn" type="date" defaultValue={today} required />
      </Field>

      <Field id="status" label="Status">
        <select
          id="status"
          name="status"
          value={status}
          onChange={(event) => {
            const next = event.target.value as (typeof STATUSES)[number];
            setStatus(next);
            if (next !== "recovery") setRecoversLogId("");
          }}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </Field>

      {status === "recovery" ? (
        <div className="sm:col-span-2 space-y-2">
          <Field id="recoversLogId" label="Recover which log?">
            {targets.length === 0 && !nextCursor ? (
              <p className="text-sm text-muted-foreground" role="status">
                No missed or partial logs available to recover for this habit.
              </p>
            ) : (
              <select
                id="recoversLogId"
                name="recoversLogId"
                required
                value={recoversLogId}
                onChange={(event) => setRecoversLogId(event.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                disabled={refreshingTargets}
              >
                <option value="">Select missed or partial…</option>
                {targets.map((target) => (
                  <option key={target.id} value={target.id}>
                    {formatRecoveryTargetLabel(target)}
                  </option>
                ))}
              </select>
            )}
          </Field>
          {nextCursor ? (
            <Button
              type="button"
              variant="outline"
              disabled={loadingOlder || refreshingTargets}
              onClick={loadOlder}
            >
              {loadingOlder ? "Loading…" : "Load older eligible records"}
            </Button>
          ) : targets.length > 0 ? (
            <p className="text-xs text-muted-foreground" role="status">
              All eligible recovery targets loaded.
            </p>
          ) : null}
        </div>
      ) : null}

      <Field id="value" label="Value (optional)">
        <Input id="value" name="value" type="number" step="any" min={0} />
      </Field>

      <Field id="notes" label="Notes (optional)">
        <Input id="notes" name="notes" maxLength={2000} />
      </Field>

      <div className="sm:col-span-2">
        <Button
          type="submit"
          disabled={
            pending ||
            refreshingTargets ||
            (status === "recovery" && targets.length === 0 && !nextCursor)
          }
        >
          {pending ? "Saving…" : "Save log"}
        </Button>
        {error ? (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="mt-2 text-sm text-muted-foreground" role="status">
            {message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
