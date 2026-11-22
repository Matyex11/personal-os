"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

type ActionResult = { ok: true; data?: unknown } | { ok: false; message: string };

type ActionFormProps = {
  action: (formData: FormData) => Promise<ActionResult>;
  children: ReactNode;
  submitLabel: string;
  className?: string;
};

export function ActionForm({ action, children, submitLabel, className }: ActionFormProps) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className={className}
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        setMessage(null);
        setError(null);
        startTransition(async () => {
          const result = await action(formData);
          if (result.ok) {
            setMessage("Saved.");
            event.currentTarget.reset();
          } else {
            setError(result.message);
          }
        });
      }}
    >
      {children}
      <Button type="submit" disabled={pending} className="mt-3">
        {pending ? "Saving…" : submitLabel}
      </Button>
      {error ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-2 text-sm text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
    </form>
  );
}
