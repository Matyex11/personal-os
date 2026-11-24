import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type TodaysCheckInSectionProps = {
  result:
    | {
        ok: true;
        data: {
          todayOn: string;
          timeZone: string;
          checkIn: {
            mood: number;
            energy: number;
            focus: number;
            body: string | null;
          } | null;
        };
      }
    | { ok: false; message: string }
    | null;
};

export function TodaysCheckInSection({ result }: TodaysCheckInSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Today&apos;s check-in</CardTitle>
        <CardDescription>
          {result?.ok
            ? `Mood, energy, and focus for ${result.data.todayOn} (${result.data.timeZone}).`
            : "Mood, energy, and focus for today in your profile timezone."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!result ? (
          <p className="text-sm text-muted-foreground">Sign in to see today&apos;s check-in.</p>
        ) : !result.ok ? (
          <p className="text-sm text-muted-foreground">{result.message}</p>
        ) : result.data.checkIn ? (
          <p className="text-sm text-foreground">
            mood {result.data.checkIn.mood} · energy {result.data.checkIn.energy} · focus{" "}
            {result.data.checkIn.focus}
            {result.data.checkIn.body ? " · note saved" : ""}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Not checked in yet today.</p>
        )}
        <Button asChild variant="outline" size="sm">
          <Link href="/check-ins">
            {result?.ok && result.data.checkIn ? "Update check-in" : "Check in"}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
