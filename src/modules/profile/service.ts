import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { AppError, toUserMessage } from "@/lib/errors";
import type { ProfileRow } from "@/lib/db/types";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_TIME_ZONE } from "@/lib/dates/calendar";
import {
  DEFAULT_BASE_CURRENCY,
  updateProfileSettingsSchema,
} from "@/modules/profile/schemas";

function zodMessage(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? "Invalid profile settings.";
  }
  return toUserMessage(error);
}

function parseOrThrow<T>(schema: z.ZodType<T>, input: unknown): T {
  try {
    return schema.parse(input);
  } catch (error) {
    throw new AppError("validation", zodMessage(error));
  }
}

export type ProfileSettingsView = {
  displayName: string | null;
  timezone: string;
  baseCurrency: string;
};

/**
 * Load the authenticated user's profile settings.
 * Missing row → defaults (does not invent a persisted row).
 */
export async function getProfileSettings(): Promise<
  { ok: true; data: ProfileSettingsView } | { ok: false; message: string }
> {
  try {
    const user = await requireUser();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("display_name, timezone, base_currency")
      .eq("id", user.id)
      .maybeSingle();
    if (error) throw new AppError("unavailable", "Could not load profile settings.");

    const row = data as Pick<
      ProfileRow,
      "display_name" | "timezone" | "base_currency"
    > | null;

    return {
      ok: true as const,
      data: {
        displayName: row?.display_name ?? null,
        timezone: row?.timezone ?? DEFAULT_TIME_ZONE,
        baseCurrency: row?.base_currency ?? DEFAULT_BASE_CURRENCY,
      },
    };
  } catch (error) {
    return { ok: false as const, message: toUserMessage(error) };
  }
}

/**
 * Update profile settings for the authenticated user only.
 * Profile id is derived exclusively from requireUser() — never from client input.
 * Verifies the affected row; inserts when the profile row is missing.
 * Does not touch habits, chapters, tasks, or other domain tables.
 */
export async function updateProfileSettings(input: unknown): Promise<
  { ok: true; data: ProfileRow } | { ok: false; message: string }
> {
  try {
    const user = await requireUser();
    const parsed = parseOrThrow(updateProfileSettingsSchema, input);
    const supabase = await createClient();

    const patch = {
      display_name: parsed.displayName,
      timezone: parsed.timezone,
      base_currency: parsed.baseCurrency,
      updated_at: new Date().toISOString(),
    };

    // Ownership: filter exclusively by session user id.
    const { data: updated, error: updateError } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", user.id)
      .select("*")
      .maybeSingle();

    if (updateError) {
      throw new AppError("unavailable", "Could not save profile settings.");
    }

    if (updated) {
      return { ok: true as const, data: updated as ProfileRow };
    }

    // Missing profile row: create one owned by the session user (never another id).
    const { data: inserted, error: insertError } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        display_name: patch.display_name,
        timezone: patch.timezone,
        base_currency: patch.base_currency,
      })
      .select("*")
      .maybeSingle();

    if (insertError) {
      throw new AppError("unavailable", "Could not create profile settings.");
    }
    if (!inserted) {
      throw new AppError(
        "unavailable",
        "Profile settings were not saved. Please try again.",
      );
    }

    return { ok: true as const, data: inserted as ProfileRow };
  } catch (error) {
    return { ok: false as const, message: toUserMessage(error) };
  }
}
