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
};

export function HabitSelector({ habits, selectedHabitId }: HabitSelectorProps) {
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
