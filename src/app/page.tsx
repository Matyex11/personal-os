import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const questions = [
  {
    title: "Where am I?",
    body: "Current chapter, active modules, and today’s operational picture — once data is connected.",
    href: "/chapters",
    cta: "Open chapters",
  },
  {
    title: "What matters now?",
    body: "Projects, milestones, and tasks that deserve attention this week.",
    href: "/projects",
    cta: "Open projects",
  },
  {
    title: "How did I do?",
    body: "Honest habit adherence, including partial, missed, and linked recovery — no vanity rewrites.",
    href: "/habits",
    cta: "Open habits",
  },
] as const;

export default function DashboardPage() {
  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Shell overview for Personal OS. No live metrics yet — Phase 1A is structure only."
      />

      <div className="grid gap-4 md:grid-cols-3">
        {questions.map((item) => (
          <Card key={item.title} className="bg-card/80">
            <CardHeader>
              <CardTitle>{item.title}</CardTitle>
              <CardDescription>{item.body}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" size="sm">
                <Link href={item.href}>{item.cta}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6">
        <EmptyState
          title="No data connected"
          description="Auth and the EU DEV Supabase project arrive in Phase 1B. This shell stays honest: no fabricated personal stats."
          action={
            <Button asChild variant="secondary" size="sm">
              <Link href="/settings">Review settings placeholders</Link>
            </Button>
          }
        />
      </div>
    </div>
  );
}
