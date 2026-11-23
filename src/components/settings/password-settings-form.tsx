"use client";

import { useState, useTransition } from "react";
import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PASSWORD_MIN_LENGTH,
  isReauthRequiredMessage,
  validatePasswordPair,
} from "@/lib/auth/password";
import { createClient } from "@/lib/supabase/client";

export function PasswordSettingsForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    const validated = validatePasswordPair(password, confirm);
    if (!validated.ok) {
      setError(validated.message);
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password: validated.password,
      });

      if (updateError) {
        if (isReauthRequiredMessage(updateError.message)) {
          setError(
            "Password change requires a recent sign-in. Sign out, sign in again with email and password or magic link, then retry. Security is not relaxed.",
          );
          return;
        }
        setError("Could not update password. Try again.");
        return;
      }

      setPassword("");
      setConfirm("");
      setMessage("Password saved. You can sign in with email and password.");
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <Field
        id="new-password"
        label="New password"
        hint={`At least ${PASSWORD_MIN_LENGTH} characters. Existing accounts only — no public recovery.`}
      >
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN_LENGTH}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </Field>

      <Field id="confirm-password" label="Confirm password" error={error ?? undefined}>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN_LENGTH}
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />
      </Field>

      <Button type="submit" disabled={pending} className="mt-1 w-fit">
        {pending ? "Saving…" : "Save password"}
      </Button>

      {message ? (
        <p className="text-sm text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
    </form>
  );
}
