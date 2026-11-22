import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getOptionalUser } from "@/lib/auth/require-user";
import { listChapters } from "@/modules/chapters/service";
import { listHabits } from "@/modules/habits/service";
import { listProjects } from "@/modules/projects/service";

export default async function DashboardPage() {
  const user = await getOptionalUser();
  const chapters = user ? await listChapters() : null;
  const habits = user ? await listHabits() : null;
  const projects = user ? await listProjects() : null;

  const current =
    chapters?.ok ? chapters.data.find((chapter) => chapter.is_current) : undefined;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Live shell over Personal OS DEV. Empty states stay honest when schema is not applied yet."
      />

      {!user ? (
        <EmptyState
          title="Sign in to continue"
          description="Protected routes require a magic-link session against personal-os-dev."
          action={
            <Button asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-card/80">
            <CardHeader>
              <CardTitle>Where am I?</CardTitle>
              <CardDescription>
                {current
                  ? `Current chapter: ${current.title}`
                  : chapters && !chapters.ok
                    ? chapters.message
                    : "No current chapter yet."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" size="sm">
                <Link href="/chapters">Open chapters</Link>
              </Button>
            </CardContent>
          </Card>
          <Card className="bg-card/80">
            <CardHeader>
              <CardTitle>What matters?</CardTitle>
              <CardDescription>
                {projects?.ok
                  ? `${projects.data.length} project(s)`
                  : projects && !projects.ok
                    ? projects.message
                    : "Projects unavailable."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" size="sm">
                <Link href="/projects">Open projects</Link>
              </Button>
            </CardContent>
          </Card>
          <Card className="bg-card/80">
            <CardHeader>
              <CardTitle>How did I do?</CardTitle>
              <CardDescription>
                {habits?.ok
                  ? `${habits.data.length} habit(s)`
                  : habits && !habits.ok
                    ? habits.message
                    : "Habits unavailable."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" size="sm">
                <Link href="/habits">Open habits</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
