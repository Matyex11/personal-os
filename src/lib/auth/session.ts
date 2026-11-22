/**
 * Auth boundary placeholder (Phase 1A).
 * Real Supabase magic-link session wiring belongs in Phase 1B+.
 */

export type SessionUser = {
  id: string;
  email: string;
};

export type SessionState =
  | { status: "anonymous" }
  | { status: "authenticated"; user: SessionUser }
  | { status: "loading" };

/** Local shell: treat the viewer as anonymous until auth is wired. */
export function getPlaceholderSession(): SessionState {
  return { status: "anonymous" };
}

export function requireUser(session: SessionState): SessionUser | null {
  if (session.status !== "authenticated") {
    return null;
  }
  return session.user;
}
