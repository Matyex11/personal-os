"use client";

import { useState } from "react";
import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { Input } from "@/components/ui/input";
import { createChapterAction } from "@/app/actions/domain";

type ChapterCreateFormProps = {
  today: string;
};

export function ChapterCreateForm({ today }: ChapterCreateFormProps) {
  const [status, setStatus] = useState<"planned" | "active">("active");

  return (
    <ActionForm
      action={createChapterAction}
      submitLabel="Create chapter"
      className="grid gap-3 sm:grid-cols-2"
    >
      <Field id="title" label="Title">
        <Input id="title" name="title" required />
      </Field>
      <Field id="startedOn" label="Started on">
        <Input id="startedOn" name="startedOn" type="date" defaultValue={today} required />
      </Field>
      <Field id="status" label="Status">
        <select
          id="status"
          name="status"
          value={status}
          onChange={(event) => setStatus(event.target.value as "planned" | "active")}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="planned">planned</option>
          <option value="active">active</option>
        </select>
      </Field>
      <label className="flex items-center gap-2 self-end text-sm">
        <input
          type="checkbox"
          name="isCurrent"
          disabled={status !== "active"}
          defaultChecked={status === "active"}
          key={status}
        />
        Mark current
        {status === "planned" ? (
          <span className="text-muted-foreground">(active only)</span>
        ) : null}
      </label>
    </ActionForm>
  );
}
