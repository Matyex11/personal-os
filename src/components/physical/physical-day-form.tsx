"use client";

import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { Input } from "@/components/ui/input";
import { upsertPhysicalMetricsForDayAction } from "@/app/actions/domain";
import {
  PHYSICAL_METRIC_DEFS,
  type PhysicalMetricKey,
} from "@/modules/physical/schemas";

type MetricDefaults = Partial<
  Record<PhysicalMetricKey, { value: number; notes?: string | null }>
>;

type PhysicalDayFormProps = {
  recordedOn: string;
  defaults?: MetricDefaults;
  submitLabel?: string;
};

function formatDefault(value: number | undefined, kind: "decimal" | "integer"): string {
  if (value === undefined || !Number.isFinite(value)) return "";
  return kind === "integer" ? String(Math.trunc(value)) : String(value);
}

export function PhysicalDayForm({
  recordedOn,
  defaults,
  submitLabel = "Save measurements",
}: PhysicalDayFormProps) {
  const sharedNotes =
    PHYSICAL_METRIC_DEFS.map((def) => defaults?.[def.key]?.notes)
      .find((notes) => notes && notes.trim().length > 0) ?? "";

  return (
    <ActionForm
      action={upsertPhysicalMetricsForDayAction}
      submitLabel={submitLabel}
      className="grid gap-3 sm:grid-cols-2"
    >
      <input type="hidden" name="recordedOn" value={recordedOn} />
      {PHYSICAL_METRIC_DEFS.map((def) => {
        const id = `${recordedOn}-${def.key}`;
        const step = def.kind === "integer" ? "1" : "0.1";
        return (
          <Field
            key={def.key}
            id={id}
            label={`${def.label} (${def.unit})`}
          >
            <Input
              id={id}
              name={def.key}
              type="number"
              inputMode="decimal"
              step={step}
              min={def.min}
              max={def.max}
              defaultValue={formatDefault(defaults?.[def.key]?.value, def.kind)}
              placeholder={`Optional · ${def.min}–${def.max}`}
            />
          </Field>
        );
      })}
      <Field id={`${recordedOn}-notes`} label="Note (optional)" className="sm:col-span-2">
        <Input
          id={`${recordedOn}-notes`}
          name="notes"
          defaultValue={sharedNotes ?? ""}
          maxLength={2000}
          placeholder="Applies to metrics saved in this submit"
        />
      </Field>
      <p className="sm:col-span-2 text-xs text-muted-foreground">
        Day: {recordedOn} · leave a field blank to skip that metric · no delete
      </p>
    </ActionForm>
  );
}
