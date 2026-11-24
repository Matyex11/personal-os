"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { NavVisibility } from "@/modules/modules/gating";

type NavLink = {
  href: "/" | "/chapters" | "/habits" | "/projects" | "/check-ins" | "/settings";
  label: string;
  key: keyof NavVisibility;
};

const links: NavLink[] = [
  { href: "/", label: "Dashboard", key: "dashboard" },
  { href: "/chapters", label: "Chapters", key: "chapters" },
  { href: "/habits", label: "Habits", key: "habits" },
  { href: "/projects", label: "Projects", key: "projects" },
  { href: "/check-ins", label: "Check-ins", key: "checkins" },
  { href: "/settings", label: "Settings", key: "settings" },
];

type AppNavProps = {
  visibility: NavVisibility;
};

export function AppNav({ visibility }: AppNavProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="flex flex-wrap items-center gap-1">
      {links
        .filter((link) => visibility[link.key])
        .map((link) => {
          const active =
            link.href === "/"
              ? pathname === "/"
              : pathname === link.href || pathname.startsWith(`${link.href}/`);

          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
              aria-current={active ? "page" : undefined}
            >
              {link.label}
            </Link>
          );
        })}
    </nav>
  );
}
