/** Minimum password length for set/change (Settings). Login does not re-enforce this. */
export const PASSWORD_MIN_LENGTH = 12;

export type PasswordPairResult =
  | { ok: true; password: string }
  | { ok: false; message: string };

/**
 * Validate a new-password + confirm pair for Settings set/change.
 * Does not call Auth — client/server forms share the same rules.
 */
export function validatePasswordPair(
  password: string,
  confirm: string,
): PasswordPairResult {
  if (!password) {
    return { ok: false, message: "Enter a password." };
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return {
      ok: false,
      message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    };
  }
  if (password !== confirm) {
    return { ok: false, message: "Passwords do not match." };
  }
  return { ok: true, password };
}

/** True when Auth error text indicates a reauthentication requirement. */
export function isReauthRequiredMessage(message: string | undefined): boolean {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return (
    normalized.includes("reauthentication") ||
    normalized.includes("re-authentication") ||
    normalized.includes("reauthenticate") ||
    normalized.includes("recent login") ||
    normalized.includes("session is not recent")
  );
}
