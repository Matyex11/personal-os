import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Chapters",
};

export default function ChaptersPage() {
  return (
    <div>
      <PageHeader
        title="Chapters"
        description="Named life periods with an explicit active/closed lifecycle. Module activations can override globals per chapter."
        actions={
          <Button type="button" disabled title="Available after Phase 1B data wiring">
            New chapter
          </Button>
        }
      />
      <EmptyState
        title="No chapters yet"
        description="Chapter create/list will use validated forms and DEV database rows in Phase 1B. Nothing is stored locally as fake history."
      />
    </div>
  );
}
