import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "@/components/states/empty-state";

describe("EmptyState", () => {
  it("shows title and description", () => {
    render(
      <EmptyState title="No chapters yet" description="Connect the DEV database in Phase 1B." />,
    );
    expect(screen.getByRole("heading", { name: "No chapters yet" })).toBeInTheDocument();
    expect(screen.getByText(/Phase 1B/)).toBeInTheDocument();
  });
});
