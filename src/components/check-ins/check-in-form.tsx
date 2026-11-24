"use client";

import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { Input } from "@/components/ui/input";
import {
  updateCheckInAction,
  upsertCheckInAction,
} from "@/app/actions/domain";

type ScoreDefaults = {
  mood: number;
  energy: number;
  focus: number;
  body?: string | null;
};

type UpsertCheckInFormProps = {
  mode: "upsert";
  checkedOn: string;
  defaults?: ScoreDefaults;
  submitLabel?: string;
};

type UpdateCheckInFormProps = {
  mode: "update";
  id: string;
  checkedOn: string;
  defaults: ScoreDefaults;
  submitLabel?: string;
};

type CheckInFormProps = UpsertCheckInFormProps | UpdateCheckInFormProps;

const SCORE_OPTIONS = [1, 2, 3, 4, 5] as const;

function ScoreSelect({
  id,
  name,
  label,
  defaultValue,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue: number;
}) {
  return (
    <Field id={id} label={label}>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue}
        required
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
      >
        {SCORE_OPTIONS.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function CheckInForm(props: CheckInFormProps) {
  const defaults = props.defaults ?? { mood: 3, energy: 3, focus: 3, body: "" };
  const isUpdate = props.mode === "update";
  const action = isUpdate ? updateCheckInAction : upsertCheckInAction;
  const submitLabel =
    props.submitLabel ?? (isUpdate ? "Update check-in" : "Save check-in");

  return (
    <ActionForm
      action={action}
      submitLabel={submitLabel}
      className="grid gap-3 sm:grid-cols-3"
    >
      {isUpdate ? (
        <input type="hidden" name="id" value={props.id} />
      ) : (
        <input type="hidden" name="checkedOn" value={props.checkedOn} />
      )}
      <ScoreSelect
        id={`${isUpdate ? props.id : "today"}-mood`}
        name="mood"
        label="Mood (1–5)"
        defaultValue={defaults.mood}
      />
      <ScoreSelect
        id={`${isUpdate ? props.id : "today"}-energy`}
        name="energy"
        label="Energy (1–5)"
        defaultValue={defaults.energy}
      />
      <ScoreSelect
        id={`${isUpdate ? props.id : "today"}-focus`}
        name="focus"
        label="Focus (1–5)"
        defaultValue={defaults.focus}
      />
      <Field
        id={`${isUpdate ? props.id : "today"}-body`}
        label="Note (optional)"
        className="sm:col-span-3"
      >
        <Input
          id={`${isUpdate ? props.id : "today"}-body`}
          name="body"
          defaultValue={defaults.body ?? ""}
          maxLength={2000}
          placeholder="Short note for your eyes only"
        />
      </Field>
      {!isUpdate ? (
        <p className="sm:col-span-3 text-xs text-muted-foreground">
          Day: {props.checkedOn} · prompt set v1_simple
        </p>
      ) : (
        <p className="sm:col-span-3 text-xs text-muted-foreground">
          Editing {props.checkedOn} · day is fixed
        </p>
      )}
    </ActionForm>
  );
}
