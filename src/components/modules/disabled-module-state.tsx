import Link from "next/link";
import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";

type DisabledModuleStateProps = {
  title: string;
  description: string;
};

export function DisabledModuleState({ title, description }: DisabledModuleStateProps) {
  return (
    <EmptyState
      title={title}
      description={description}
      action={
        <Button asChild variant="outline">
          <Link href="/chapters">Open Chapters to activate</Link>
        </Button>
      }
    />
  );
}
