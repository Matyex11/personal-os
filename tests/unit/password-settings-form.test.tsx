import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PasswordSettingsForm } from "@/components/settings/password-settings-form";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password";

const updateUser = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      updateUser,
    },
  }),
}));

/** Synthetic fixture only — never real E2E / operator secrets. */
const SYNTHETIC_PASSWORD = `synth-valid-${"x".repeat(Math.max(0, PASSWORD_MIN_LENGTH - 12))}`;

describe("PasswordSettingsForm", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    updateUser.mockReset();
  });

  it("calls updateUser with a matching valid password and shows success", async () => {
    const user = userEvent.setup();
    updateUser.mockResolvedValue({ error: null });

    render(<PasswordSettingsForm />);

    await user.type(screen.getByLabelText("New password"), SYNTHETIC_PASSWORD);
    await user.type(screen.getByLabelText("Confirm password"), SYNTHETIC_PASSWORD);
    await user.click(screen.getByRole("button", { name: "Save password" }));

    await vi.waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith({ password: SYNTHETIC_PASSWORD });
    });

    expect(await screen.findByRole("status")).toHaveTextContent(/password saved/i);
    expect(screen.getByLabelText("New password")).toHaveValue("");
    expect(screen.getByLabelText("Confirm password")).toHaveValue("");
  });

  it("surfaces reauthentication errors from Auth", async () => {
    const user = userEvent.setup();
    updateUser.mockResolvedValue({
      error: { message: "Reauthentication required" },
    });

    render(<PasswordSettingsForm />);

    await user.type(screen.getByLabelText("New password"), SYNTHETIC_PASSWORD);
    await user.type(screen.getByLabelText("Confirm password"), SYNTHETIC_PASSWORD);
    await user.click(screen.getByRole("button", { name: "Save password" }));

    await vi.waitFor(() => {
      expect(updateUser).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(/recent sign-in/i);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("surfaces generic Auth update errors", async () => {
    const user = userEvent.setup();
    updateUser.mockResolvedValue({
      error: { message: "Same password detected" },
    });

    render(<PasswordSettingsForm />);

    await user.type(screen.getByLabelText("New password"), SYNTHETIC_PASSWORD);
    await user.type(screen.getByLabelText("Confirm password"), SYNTHETIC_PASSWORD);
    await user.click(screen.getByRole("button", { name: "Save password" }));

    await vi.waitFor(() => {
      expect(updateUser).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not update password/i);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("does not call updateUser when passwords mismatch", async () => {
    const user = userEvent.setup();
    const left = "a".repeat(PASSWORD_MIN_LENGTH);
    const right = "b".repeat(PASSWORD_MIN_LENGTH);

    render(<PasswordSettingsForm />);

    await user.type(screen.getByLabelText("New password"), left);
    await user.type(screen.getByLabelText("Confirm password"), right);
    await user.click(screen.getByRole("button", { name: "Save password" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/passwords do not match/i);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("does not call updateUser when the password is too short", async () => {
    const user = userEvent.setup();
    const short = "a".repeat(PASSWORD_MIN_LENGTH - 1);

    render(<PasswordSettingsForm />);

    await user.type(screen.getByLabelText("New password"), short);
    await user.type(screen.getByLabelText("Confirm password"), short);
    await user.click(screen.getByRole("button", { name: "Save password" }));

    // Browser minLength may block submit; either way Auth must not be called.
    expect(updateUser).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).toBeNull();
  });
});
