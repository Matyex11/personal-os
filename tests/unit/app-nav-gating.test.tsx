import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppNav } from "@/components/layout/app-nav";
import type { NavVisibility } from "@/modules/modules/gating";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
    "aria-current"?: "page" | undefined;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const always: NavVisibility = {
  dashboard: true,
  chapters: true,
  settings: true,
  habits: false,
  projects: false,
  checkins: false,
  reviews: false,
  physical: false,
};

afterEach(() => {
  cleanup();
});

describe("AppNav module visibility", () => {
  it("hides habits, projects, check-ins, reviews, and physical when inactive", () => {
    render(<AppNav visibility={always} />);
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Chapters" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Habits" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Projects" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Check-ins" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Reviews" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Physical" })).not.toBeInTheDocument();
  });

  it("shows habits, projects, check-ins, reviews, and physical when visibility allows", () => {
    render(
      <AppNav
        visibility={{
          ...always,
          habits: true,
          projects: true,
          checkins: true,
          reviews: true,
          physical: true,
        }}
      />,
    );
    expect(screen.getByRole("link", { name: "Habits" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Projects" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Check-ins" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Reviews" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Physical" })).toBeInTheDocument();
  });
});
