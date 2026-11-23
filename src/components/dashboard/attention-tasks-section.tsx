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
import type { AttentionTaskRow } from "@/modules/dashboard/attention-tasks";

type AttentionTasksSectionProps = {
  result:
    | { ok: true; data: { todayOn: string; tasks: AttentionTaskRow[] } }
    | { ok: false; message: string }
    | null;
};

export function AttentionTasksSection({ result }: AttentionTasksSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>What matters now?</CardTitle>
        <CardDescription>
          Open tasks overdue or due within 7 days
          {result?.ok ? ` (as of ${result.data.todayOn})` : ""}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!result ? (
          <p className="text-sm text-muted-foreground">Sign in to see tasks that need attention.</p>
        ) : !result.ok ? (
          <p className="text-sm text-muted-foreground">{result.message}</p>
        ) : result.data.tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing overdue or due in the next week.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {result.data.tasks.map((task) => (
              <li key={task.id} className="space-y-0.5 py-2 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-foreground">{task.title}</span>
                  <span
                    className={cn(
                      "text-muted-foreground",
                      task.overdue && "font-medium text-destructive",
                    )}
                  >
                    {task.overdue ? "overdue" : "due"} {task.dueOn} · {task.status}
                  </span>
                </div>
                {(task.projectTitle || task.milestoneTitle) && (
                  <p className="text-xs text-muted-foreground">
                    {[task.projectTitle, task.milestoneTitle].filter(Boolean).join(" · ")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
        <Button asChild variant="outline" size="sm">
          <Link href="/projects">Open projects</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
