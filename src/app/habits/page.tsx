import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Habits",
};

export default function HabitsPage() {
  return (
    <div>
      <PageHeader
        title="Habits"
        description="Min vs target, five statuses, and recovery as a linked event that never rewrites a miss."
        actions={
          <Button type="button" disabled title="Available after Phase 1B data wiring">
            Log habit
          </Button>
        }
      />
      <EmptyState
        title="Habit logging not connected"
        description="Domain schemas and adherence helpers are ready under src/modules/habits. UI logging waits for Phase 1B."
      />
    </div>
  );
}
