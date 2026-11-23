"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProfileSettingsAction } from "@/app/actions/domain";
import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DISPLAY_NAME_MAX_LENGTH } from "@/modules/profile/schemas";

const selectClassName =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

type ProfileSettingsFormProps = {
  displayName: string;
  timezone: string;
  baseCurrency: string;
  timeZones: readonly string[];
  currencies: readonly string[];
};

export function ProfileSettingsForm({
  displayName,
  timezone,
  baseCurrency,
  timeZones,
  currencies,
}: ProfileSettingsFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Remount when saved values change so defaultValue tracks server state after refresh.
  const formKey = `${displayName}|${timezone}|${baseCurrency}`;

  return (
    <form
      key={formKey}
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        setMessage(null);
        setError(null);
        startTransition(async () => {
          const result = await updateProfileSettingsAction(formData);
          if (result.ok) {
            setMessage("Profile settings saved.");
            router.refresh();
          } else {
            setError(result.message);
          }
        });
      }}
    >
      <Field
        id="displayName"
        label="Display name"
        hint={`Optional. Up to ${DISPLAY_NAME_MAX_LENGTH} characters.`}
      >
        <Input
          id="displayName"
          name="displayName"
          defaultValue={displayName}
          maxLength={DISPLAY_NAME_MAX_LENGTH}
          autoComplete="nickname"
          placeholder="Your name"
        />
      </Field>

      <Field
        id="timezone"
        label="Timezone"
        hint="Used for habit dates, dashboard “today”, and reporting windows."
      >
        <select
          id="timezone"
          name="timezone"
          defaultValue={timezone}
          required
          className={selectClassName}
        >
          {timeZones.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </select>
      </Field>

      <Field
        id="baseCurrency"
        label="Base currency"
        hint="Preference only — no conversion or financial calculations."
      >
        <select
          id="baseCurrency"
          name="baseCurrency"
          defaultValue={baseCurrency}
          required
          className={selectClassName}
        >
          {currencies.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
      </Field>

      <Button type="submit" disabled={pending} className="mt-1 w-fit">
        {pending ? "Saving…" : "Save profile"}
      </Button>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="text-sm text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
    </form>
  );
}
