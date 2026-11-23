import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/components/auth/login-form";

const replace = vi.fn();
const refresh = vi.fn();
const signInWithPassword = vi.fn();
const signInWithOtp = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword,
      signInWithOtp,
    },
  }),
}));

describe("LoginForm", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    replace.mockReset();
    refresh.mockReset();
    signInWithPassword.mockReset();
    signInWithOtp.mockReset();
  });

  it("signs in with email and password by default", async () => {
    const user = userEvent.setup();
    signInWithPassword.mockResolvedValue({ error: null });

    render(<LoginForm nextPath="/settings" />);

    await user.type(screen.getByLabelText("Email"), "  ops@example.com  ");
    await user.type(screen.getByLabelText("Password"), "secret12");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await vi.waitFor(() => {
      expect(signInWithPassword).toHaveBeenCalledWith({
        email: "ops@example.com",
        password: "secret12",
      });
    });
    expect(replace).toHaveBeenCalledWith("/settings");
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("keeps magic-link fallback with shouldCreateUser false", async () => {
    const user = userEvent.setup();
    signInWithOtp.mockResolvedValue({ error: null });

    render(<LoginForm nextPath="/habits" />);

    await user.click(screen.getByRole("button", { name: "Use magic link instead" }));
    await user.type(screen.getByLabelText("Email"), "ops@example.com");
    await user.click(screen.getByRole("button", { name: "Send magic link" }));

    await vi.waitFor(() => {
      expect(signInWithOtp).toHaveBeenCalled();
    });

    const call = signInWithOtp.mock.calls[0]?.[0] as {
      email: string;
      options: { shouldCreateUser: boolean; emailRedirectTo: string };
    };
    expect(call.email).toBe("ops@example.com");
    expect(call.options.shouldCreateUser).toBe(false);
    expect(call.options.emailRedirectTo).toContain("/auth/callback?next=%2Fhabits");
    expect(signInWithPassword).not.toHaveBeenCalled();
  });
});
