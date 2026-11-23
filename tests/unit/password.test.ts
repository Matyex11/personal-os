import { describe, expect, it } from "vitest";
import {
  PASSWORD_MIN_LENGTH,
  isReauthRequiredMessage,
  validatePasswordPair,
} from "@/lib/auth/password";

describe("validatePasswordPair", () => {
  it("exports a 12-character minimum", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(12);
  });

  it("accepts matching passwords at the minimum length", () => {
    const password = "a".repeat(PASSWORD_MIN_LENGTH);
    expect(validatePasswordPair(password, password)).toEqual({
      ok: true,
      password,
    });
  });

  it("rejects empty, short, and mismatched passwords", () => {
    expect(validatePasswordPair("", "")).toEqual({
      ok: false,
      message: "Enter a password.",
    });
    expect(
      validatePasswordPair(
        "a".repeat(PASSWORD_MIN_LENGTH - 1),
        "a".repeat(PASSWORD_MIN_LENGTH - 1),
      ),
    ).toEqual({
      ok: false,
      message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    });
    expect(
      validatePasswordPair(
        "a".repeat(PASSWORD_MIN_LENGTH),
        "b".repeat(PASSWORD_MIN_LENGTH),
      ),
    ).toEqual({
      ok: false,
      message: "Passwords do not match.",
    });
  });
});

describe("isReauthRequiredMessage", () => {
  it("detects reauthentication phrasing from Auth errors", () => {
    expect(isReauthRequiredMessage("Reauthentication required")).toBe(true);
    expect(isReauthRequiredMessage("Please reauthenticate to continue")).toBe(true);
    expect(isReauthRequiredMessage("A recent login is required")).toBe(true);
    expect(isReauthRequiredMessage("Invalid login credentials")).toBe(false);
    expect(isReauthRequiredMessage(undefined)).toBe(false);
  });
});
