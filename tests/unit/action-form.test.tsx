import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionForm } from "@/components/forms/action-form";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

describe("ActionForm", () => {
  afterEach(() => {
    cleanup();
    refresh.mockReset();
  });

  it("captures the form element before await and resets after a successful action", async () => {
    const user = userEvent.setup();
    let resolveAction: (value: { ok: true }) => void = () => undefined;
    const action = vi.fn(
      () =>
        new Promise<{ ok: true }>((resolve) => {
          resolveAction = resolve;
        }),
    );

    const { container } = render(
      <ActionForm action={action} submitLabel="Create item">
        <label>
          Title
          <input name="title" defaultValue="keep-me" />
        </label>
      </ActionForm>,
    );

    const form = container.querySelector("form");
    expect(form).toBeTruthy();
    const resetSpy = vi.spyOn(form!, "reset");

    await user.click(screen.getByRole("button", { name: "Create item" }));
    expect(action).toHaveBeenCalledTimes(1);

    // After the submit handler returns, React nulls event.currentTarget.
    // The form reference captured synchronously must still drive reset().
    resolveAction({ ok: true });

    await vi.waitFor(() => {
      expect(resetSpy).toHaveBeenCalledTimes(1);
    });
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalled();
    });
    expect(await screen.findByRole("status")).toHaveTextContent(/Saved/i);
  });

  it("does not reset the form when the action fails", async () => {
    const user = userEvent.setup();
    const action = vi.fn(async () => ({ ok: false as const, message: "Nope" }));

    const { container } = render(
      <ActionForm action={action} submitLabel="Create item">
        <label>
          Title
          <input name="title" defaultValue="keep-me" />
        </label>
      </ActionForm>,
    );

    const form = container.querySelector("form");
    const resetSpy = vi.spyOn(form!, "reset");

    await user.click(screen.getByRole("button", { name: "Create item" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Nope/);
    expect(resetSpy).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });
});
