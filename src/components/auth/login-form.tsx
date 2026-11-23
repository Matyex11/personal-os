"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/forms/field";
import { Input } from "@/components/ui/input";
import { safeNextPath } from "@/lib/auth/safe-next-path";
import { createClient } from "@/lib/supabase/client";

type LoginMode = "password" | "magic-link";

type LoginFormProps = {
  nextPath: string;
};

/**
 * Mark the form hydrated for Playwright. Attribute is absent in SSR HTML;
 * the ref sets data-auth-ready="true" after client handlers attach.
 */
function markAuthFormReady(node: HTMLFormElement | null) {
  if (node) {
    node.dataset.authReady = "true";
  }
}

export function LoginForm({ nextPath }: LoginFormProps) {
  const [mode, setMode] = useState<LoginMode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function switchMode(next: LoginMode) {
    setMode(next);
    setMessage(null);
    setError(null);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    const safeNext = safeNextPath(nextPath);
    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      setError("Enter an email address.");
      return;
    }

    setPending(true);
    try {
      const supabase = createClient();

      if (mode === "password") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

        if (signInError) {
          setError("Could not sign in. Check email and password, then try again.");
          return;
        }

        // Full navigation so proxy/SSR see cookies written by the browser client.
        window.location.assign(safeNext);
        return;
      }

      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}`;
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          emailRedirectTo: redirectTo,
          // Existing accounts only — first DEV user is created manually in dashboard.
          shouldCreateUser: false,
        },
      });

      if (signInError) {
        setError("Could not send magic link. Check the address and try again.");
        return;
      }
      setMessage("Magic link sent. Check your email to continue.");
    } catch {
      setError(
        mode === "password"
          ? "Could not sign in. Check email and password, then try again."
          : "Could not send magic link. Check the address and try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      ref={markAuthFormReady}
      method="post"
      action="/login"
      onSubmit={onSubmit}
      className="space-y-4 rounded-lg border border-border bg-card/80 p-5"
    >
      <Field id="email" label="Email" error={error ?? undefined}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
        />
      </Field>

      {mode === "password" ? (
        <Field id="password" label="Password">
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Your password"
          />
        </Field>
      ) : null}

      <Button type="submit" disabled={pending} className="w-full">
        {pending
          ? mode === "password"
            ? "Signing in…"
            : "Sending…"
          : mode === "password"
            ? "Sign in"
            : "Send magic link"}
      </Button>

      <div className="text-center">
        {mode === "password" ? (
          <button
            type="button"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => switchMode("magic-link")}
            disabled={pending}
          >
            Use magic link instead
          </button>
        ) : (
          <button
            type="button"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => switchMode("password")}
            disabled={pending}
          >
            Use email and password
          </button>
        )}
      </div>

      {message ? (
        <p className="text-sm text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
    </form>
  );
}
