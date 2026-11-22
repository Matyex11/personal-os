import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";

export type AuthUser = {
  id: string;
  email: string | undefined;
};

/**
 * Server-side auth gate using verified JWT claims (not getSession).
 * Never trust client-supplied user ids.
 */
export async function requireUser(): Promise<AuthUser> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) {
    throw new AppError("unauthorized", "Sign in required.");
  }

  const email =
    typeof data.claims.email === "string" ? data.claims.email : undefined;

  return { id: data.claims.sub, email };
}

export async function getOptionalUser(): Promise<AuthUser | null> {
  try {
    return await requireUser();
  } catch {
    return null;
  }
}
