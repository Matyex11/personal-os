import type { ReactNode } from "react";
import Link from "next/link";
import { AppNav } from "@/components/layout/app-nav";
import { Separator } from "@/components/ui/separator";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-app-atmosphere" aria-hidden />
      <header className="border-b border-border/80 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <Link href="/" className="font-serif text-2xl font-semibold tracking-tight text-foreground">
                Personal OS
              </Link>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                Where am I · What matters · How did I do
              </p>
            </div>
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Phase 1A shell</p>
          </div>
          <AppNav />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">{children}</main>
      <footer className="mx-auto w-full max-w-5xl px-4 pb-10 sm:px-6">
        <Separator className="mb-4" />
        <p className="text-xs text-muted-foreground">
          Local foundation only — database and auth connect in Phase 1B.
        </p>
      </footer>
    </div>
  );
}
