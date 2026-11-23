import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ProfileSettingsForm } from "@/components/settings/profile-settings-form";
import { getOptionalUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_TIME_ZONE } from "@/lib/dates/calendar";
import type { ProfileRow } from "@/lib/db/types";
import {
  DEFAULT_BASE_CURRENCY,
  listIanaTimeZones,
  listIsoCurrencies,
} from "@/modules/profile/schemas";

export const metadata = {
  title: "Settings",
};

function withCurrentOption(options: readonly string[], current: string): string[] {
  if (options.includes(current)) return [...options];
  return [current, ...options];
}

export default async function SettingsPage() {
  const user = await getOptionalUser();
  const supabase = await createClient();
  const { data: profile } = user
    ? await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()
    : { data: null };

  const row = profile as ProfileRow | null;
  const displayName = row?.display_name ?? "";
  const timezone = row?.timezone ?? DEFAULT_TIME_ZONE;
  const baseCurrency = row?.base_currency ?? DEFAULT_BASE_CURRENCY;
  const timeZones = withCurrentOption(listIanaTimeZones(), timezone);
  const currencies = withCurrentOption(listIsoCurrencies(), baseCurrency);

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
            <CardTitle>Profile settings</CardTitle>
            <CardDescription>
              Display name, timezone, and base currency for your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {user ? (
              <ProfileSettingsForm
                displayName={displayName}
                timezone={timezone}
                baseCurrency={baseCurrency}
                timeZones={timeZones}
                currencies={currencies}
              />
            ) : (
              <div className="space-y-2 text-sm">
                <p className="text-muted-foreground">
                  Sign in to edit profile settings.
                </p>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Timezone</span>
                  <span className="font-medium">{timezone}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Base currency</span>
                  <span className="font-medium">{baseCurrency}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
