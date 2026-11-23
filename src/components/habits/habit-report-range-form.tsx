"use client";

import { usePathname, useRouter } from "next/navigation";
import { Field } from "@/components/forms/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { isoDateSchema } from "@/lib/validation/common";

type HabitReportRangeFormProps = {
  habitId: string;
  fromOn: string;
  toOn: string;
  maxOn: string;
};

function dateInputType(value: string): "date" | "text" {
  // HTML date inputs drop non-calendar values; use text so invalid submissions stay visible.
  return isoDateSchema.safeParse(value).success ? "date" : "text";
}

/**
 * Updates `?habit=&from=&to=` via client navigation so habit switches can
 * preserve the same range (HabitSelector reads the same params).
 */
export function HabitReportRangeForm({
  habitId,
  fromOn,
  toOn,
  maxOn,
}: HabitReportRangeFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const fromType = dateInputType(fromOn);
  const toType = dateInputType(toOn);

  return (
    <form
      className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const next = new URLSearchParams();
        next.set("habit", habitId);
        next.set("from", String(formData.get("from") ?? ""));
        next.set("to", String(formData.get("to") ?? ""));
        router.push(`${pathname}?${next.toString()}`);
      }}
    >
      <Field id="from" label="From">
        <Input
          id="from"
          name="from"
          type={fromType}
          defaultValue={fromOn}
          max={fromType === "date" ? maxOn : undefined}
          placeholder="YYYY-MM-DD"
          required
        />
      </Field>
      <Field id="to" label="To">
        <Input
          id="to"
          name="to"
          type={toType}
          defaultValue={toOn}
          max={toType === "date" ? maxOn : undefined}
          placeholder="YYYY-MM-DD"
          required
        />
      </Field>
      <Button type="submit">Apply range</Button>
    </form>
  );
}
