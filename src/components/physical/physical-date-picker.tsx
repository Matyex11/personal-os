"use client";

import { useRouter } from "next/navigation";
import { Field } from "@/components/forms/field";
import { Input } from "@/components/ui/input";

type PhysicalDatePickerProps = {
  todayOn: string;
  selectedOn: string;
};

export function PhysicalDatePicker({ todayOn, selectedOn }: PhysicalDatePickerProps) {
  const router = useRouter();

  return (
    <Field id="physical-day" label="Edit another day">
      <Input
        id="physical-day"
        type="date"
        max={todayOn}
        defaultValue={selectedOn}
        onChange={(event) => {
          const next = event.target.value;
          if (!/^\d{4}-\d{2}-\d{2}$/.test(next)) return;
          if (next === todayOn) {
            router.push("/physical");
            return;
          }
          router.push(`/physical?on=${encodeURIComponent(next)}`);
        }}
      />
    </Field>
  );
}
