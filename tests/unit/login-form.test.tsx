import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/components/auth/login-form";

const signInWithPassword = vi.fn();
const signInWithOtp = vi.fn();
const locationAssign = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword,
      signInWithOtp,
    },
  }),
}));

async function waitForAuthReady() {
  await vi.waitFor(() => {
    expect(document.querySelector("form[data-auth-ready='true']")).not.toBeNull();
  });
}

describe("LoginForm", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    signInWithPassword.mockReset();
    signInWithOtp.mockReset();
    locationAssign.mockReset();
    vi.stubGlobal(
      "location",
      Object.assign(new URL("http://127.0.0.1:3000/login"), {
        assign: locationAssign,
        replace: vi.fn(),
        reload: vi.fn(),
      }),
    );
  });

  it("signs in with email and password by default", async () => {
    const user = userEvent.setup();
    signInWithPassword.mockResolvedValue({ error: null });

    render(<LoginForm nextPath="/settings" />);
    await waitForAuthReady();

    await user.type(screen.getByLabelText("Email"), "  ops@example.com  ");
    await user.type(screen.getByLabelText("Password"), "secret12");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await vi.waitFor(() => {
      expect(signInWithPassword).toHaveBeenCalledWith({
        email: "ops@example.com",
        password: "secret12",
      });
    });
    expect(locationAssign).toHaveBeenCalledWith("/settings");
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("keeps magic-link fallback with shouldCreateUser false", async () => {
    const user = userEvent.setup();
    signInWithOtp.mockResolvedValue({ error: null });

    render(<LoginForm nextPath="/habits" />);
    await waitForAuthReady();

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
    expect(locationAssign).not.toHaveBeenCalled();
  });
});
