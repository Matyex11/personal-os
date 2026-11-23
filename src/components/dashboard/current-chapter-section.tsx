import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { CurrentChapterSummary } from "@/modules/dashboard/service";

type CurrentChapterSectionProps = {
  result:
    | { ok: true; data: CurrentChapterSummary | null }
    | { ok: false; message: string }
    | null;
};

export function CurrentChapterSection({ result }: CurrentChapterSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Where am I?</CardTitle>
        <CardDescription>Current chapter — not inferred when none is marked.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!result ? (
          <p className="text-sm text-muted-foreground">Sign in to see your chapter.</p>
        ) : !result.ok ? (
          <p className="text-sm text-muted-foreground">{result.message}</p>
        ) : !result.data ? (
          <p className="text-sm text-muted-foreground">
            No current chapter. Open chapters to mark one.
          </p>
        ) : (
          <div className="space-y-1 text-sm">
            <p className="font-medium text-foreground">{result.data.title}</p>
            <p className="text-muted-foreground">
              Status {result.data.status} · started {result.data.startedOn}
            </p>
          </div>
        )}
        <Button asChild variant="outline" size="sm">
          <Link href="/chapters">Open chapters</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
