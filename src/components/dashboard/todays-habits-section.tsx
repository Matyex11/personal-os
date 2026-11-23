import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { TodayHabitOutcome, TodayHabitRow } from "@/modules/dashboard/habits-today";

type TodaysHabitsSectionProps = {
  result:
    | {
        ok: true;
        data: { todayOn: string; timeZone: string; habits: TodayHabitRow[] };
      }
    | { ok: false; message: string }
    | null;
};

function outcomeLabel(outcome: TodayHabitOutcome): string {
  switch (outcome) {
    case "completed":
      return "completed";
    case "partial":
      return "partial";
    case "missed":
      return "missed";
    case "unlogged":
      return "unlogged";
    case "not_scheduled":
      return "not scheduled";
  }
}

export function TodaysHabitsSection({ result }: TodaysHabitsSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>How did I do today?</CardTitle>
        <CardDescription>
          {result?.ok
            ? `Active habits for ${result.data.todayOn} (${result.data.timeZone}).`
            : "Active habits for today in your profile timezone."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!result ? (
          <p className="text-sm text-muted-foreground">Sign in to see today&apos;s habits.</p>
        ) : !result.ok ? (
          <p className="text-sm text-muted-foreground">{result.message}</p>
        ) : result.data.habits.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active habits yet.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {result.data.habits.map((habit) => (
              <li
                key={habit.habitId}
                className={cn(
                  "flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm",
                  habit.outcome === "unlogged" &&
                    "rounded-sm border border-dashed border-border bg-muted/40 px-2",
                )}
              >
                <span className="font-medium text-foreground">{habit.name}</span>
                <span
                  className={cn(
                    "text-muted-foreground",
                    habit.outcome === "unlogged" && "font-semibold text-foreground",
                    habit.outcome === "missed" && "text-destructive",
                    habit.outcome === "completed" && "text-foreground",
                  )}
                >
                  {outcomeLabel(habit.outcome)}
                  {habit.recoveryLoggedToday ? " · recovery logged today" : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Button asChild variant="outline" size="sm">
          <Link href="/habits">Open habits</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
