import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renders label text", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("can be disabled", () => {
    render(<Button disabled>New chapter</Button>);
    expect(screen.getByRole("button", { name: "New chapter" })).toBeDisabled();
  });
});
