import type { ReactNode } from "react";
import Link from "next/link";
import { AppNav } from "@/components/layout/app-nav";
import { ModuleActivationWarning } from "@/components/layout/module-activation-warning";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { getOptionalUser } from "@/lib/auth/require-user";
import {
  getSessionModuleGating,
  PRESERVE_NAV_VISIBILITY,
} from "@/modules/modules/gating";

type AppShellProps = {
  children: ReactNode;
};

export async function AppShell({ children }: AppShellProps) {
  const user = await getOptionalUser();
  const gating = user ? await getSessionModuleGating() : null;
  const visibility = gating?.nav ?? PRESERVE_NAV_VISIBILITY;

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-app-atmosphere" aria-hidden />
      <header className="border-b border-border/80 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <Link href="/" className="font-serif text-2xl font-semibold tracking-tight text-foreground">
                Personal OS
              </Link>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                Where am I · What matters · How did I do
              </p>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Phase 2</p>
              {user ? (
                <form action="/auth/signout" method="post">
                  <Button type="submit" variant="outline" size="sm">
                    Sign out
                  </Button>
                </form>
              ) : (
                <Button asChild variant="outline" size="sm">
                  <Link href="/login">Sign in</Link>
                </Button>
              )}
            </div>
          </div>
          {gating?.resolutionFailed ? (
            <ModuleActivationWarning message={gating.message} />
          ) : null}
          <AppNav visibility={visibility} />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">{children}</main>
      <footer className="mx-auto w-full max-w-5xl px-4 pb-10 sm:px-6">
        <Separator className="mb-4" />
        <p className="text-xs text-muted-foreground">
          DEV target personal-os-dev (eu-central-1). Further hosted schema apply, Docker, and deploy stay L3.
        </p>
      </footer>
    </div>
  );
}
