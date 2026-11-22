import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { getOptionalUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const user = await getOptionalUser();
  const supabase = await createClient();
  const { data: profile } = user
    ? await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()
    : { data: null };

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Auth session and profile defaults. Publishable key only — no service-role in the app."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Session</CardTitle>
            <CardDescription>Verified via getClaims() on the server.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium">{user ? "authenticated" : "anonymous"}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{user?.email ?? "—"}</span>
            </div>
            <Separator />
            {user ? (
              <form action="/auth/signout" method="post">
                <Button type="submit" variant="outline" size="sm">
                  Sign out
                </Button>
              </form>
            ) : (
              <p className="text-muted-foreground">Use Sign in from the header.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Profile defaults</CardTitle>
            <CardDescription>From profiles table when present.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Timezone</span>
              <span className="font-medium">{profile?.timezone ?? "Europe/Bucharest"}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Base currency</span>
              <span className="font-medium">{profile?.base_currency ?? "RON"}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Auth</span>
              <span className="font-medium">Email magic link</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
