import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getPlaceholderSession } from "@/lib/auth/session";

export const metadata = {
  title: "Settings",
};

export default function SettingsPage() {
  const session = getPlaceholderSession();

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Profile defaults and auth boundary placeholders. No secrets are loaded in Phase 1A."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Session</CardTitle>
            <CardDescription>Auth wiring is deferred to Phase 1B (email magic link).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium capitalize">{session.status}</span>
            </div>
            <Separator />
            <p className="text-muted-foreground">
              Anonymous shell session. Sign-in UI will appear after DEV Supabase Auth is connected.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Defaults</CardTitle>
            <CardDescription>Provisional product defaults from Phase 0.1 decisions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Timezone</span>
              <span className="font-medium">Europe/Bucharest</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Base currency</span>
              <span className="font-medium">RON</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Auth (planned)</span>
              <span className="font-medium">Email magic link</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
