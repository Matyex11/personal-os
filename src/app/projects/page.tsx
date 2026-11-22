import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Projects",
};

export default function ProjectsPage() {
  return (
    <div>
      <PageHeader
        title="Projects"
        description="Projects, milestones, and tasks stay separate concepts with optional same-user links."
        actions={
          <Button type="button" disabled title="Available after Phase 1B data wiring">
            New project
          </Button>
        }
      />
      <EmptyState
        title="No projects yet"
        description="Create/list flows will land with Zod-validated inputs once the DEV database is approved and wired."
      />
    </div>
  );
}
