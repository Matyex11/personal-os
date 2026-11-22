import type { HabitLogRow } from "@/lib/db/types";
import { formatHabitLogHistoryLine } from "@/modules/habits/recovery-targets";

type HabitLogHistoryProps = {
  habitName: string;
  logs: HabitLogRow[];
};

export function HabitLogHistory({ habitName, logs }: HabitLogHistoryProps) {
  const byId = new Map(logs.map((log) => [log.id, log]));

  return (
    <div className="space-y-2 text-sm">
      <p className="text-muted-foreground">Recent logs · {habitName}</p>
      {logs.length === 0 ? (
        <p className="text-muted-foreground">No logs yet for this habit.</p>
      ) : (
        logs.map((log) => (
          <div
            key={log.id}
            className="flex justify-between gap-3 border-b border-border/60 py-2"
          >
            <span>{formatHabitLogHistoryLine(log, byId)}</span>
            {log.value != null ? (
              <span className="text-muted-foreground tabular-nums">{log.value}</span>
            ) : null}
          </div>
        ))
      )}
    </div>
  );
}
