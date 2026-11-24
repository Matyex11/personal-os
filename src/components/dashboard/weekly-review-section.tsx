import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type WeeklyReviewSectionProps = {
  result:
    | {
        ok: true;
        data: {
          state: "missing" | "draft" | "completed";
          periodStart: string;
          periodEnd: string;
          timeZone: string;
        };
      }
    | { ok: false; message: string }
    | null;
};

function statusCopy(state: "missing" | "draft" | "completed"): string {
  switch (state) {
    case "missing":
      return "No review started for this week yet.";
    case "draft":
      return "Draft in progress — not completed.";
    case "completed":
      return "This week’s review is completed.";
  }
}

export function WeeklyReviewSection({ result }: WeeklyReviewSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly review</CardTitle>
        <CardDescription>
          {result?.ok
            ? `ISO week ${result.data.periodStart} → ${result.data.periodEnd} (${result.data.timeZone}).`
            : "Current ISO week in your profile timezone."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!result ? (
          <p className="text-sm text-muted-foreground">Sign in to see weekly review status.</p>
        ) : !result.ok ? (
          <p className="text-sm text-muted-foreground">{result.message}</p>
        ) : (
          <p className="text-sm text-foreground">{statusCopy(result.data.state)}</p>
        )}
        <Button asChild variant="outline" size="sm">
          <Link href="/reviews">
            {result?.ok && result.data.state === "completed"
              ? "Open review"
              : result?.ok && result.data.state === "draft"
                ? "Continue draft"
                : "Start weekly review"}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
