"use client";

import { useRouter, usePathname } from "next/navigation";

export type HabitOption = {
  id: string;
  name: string;
  is_active: boolean;
};

type HabitSelectorProps = {
  habits: HabitOption[];
  selectedHabitId: string;
  /** Preserve reporting window across habit switches. */
  fromOn?: string;
  toOn?: string;
};

export function HabitSelector({
  habits,
  selectedHabitId,
  fromOn,
  toOn,
}: HabitSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium">Selected habit</span>
      <select
        className="flex h-10 w-full max-w-md rounded-md border border-input bg-background px-3 text-sm"
        value={selectedHabitId}
        onChange={(event) => {
          const next = new URLSearchParams();
          next.set("habit", event.target.value);
          if (fromOn) next.set("from", fromOn);
          if (toOn) next.set("to", toOn);
          router.push(`${pathname}?${next.toString()}`);
        }}
        aria-label="Selected habit"
      >
        {habits.map((habit) => (
          <option key={habit.id} value={habit.id}>
            {habit.name}
            {habit.is_active ? "" : " (inactive)"}
          </option>
        ))}
      </select>
    </label>
  );
}
