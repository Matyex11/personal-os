import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { test as setup, expect } from "@playwright/test";

/** Gitignored path consumed by the chromium-authenticated Playwright project. */
export const AUTH_STORAGE_STATE_PATH = path.join(
  __dirname,
  ".auth",
  "user.json",
);

/**
 * Fail closed: require real shell credentials. Never invent, hardcode, or read
 * secrets from tracked files / .env.local.
 */
function requireE2ECredentials(): { email: string; password: string } {
  const email = process.env.E2E_USER_EMAIL?.trim() ?? "";
  const password = process.env.E2E_USER_PASSWORD ?? "";

  if (!email || !password) {
    throw new Error(
      [
        "Missing E2E_USER_EMAIL and/or E2E_USER_PASSWORD.",
        "Set both in the shell (or a local secret store) for a dedicated personal-os-dev test user",
        "that already has a password (see Project store docs/auth-email-password-stage-1.md).",
        "Auth preflight will not invent accounts, invent passwords, bypass Auth, or weaken signup controls.",
      ].join(" "),
    );
  }

  return { email, password };
}

/**
 * Fail closed when authenticated e2e cannot run safely.
 * Never log or return cookie/token contents — only presence and coarse shape.
 */
function assertAuthStorageStatePresent(): void {
  if (!existsSync(AUTH_STORAGE_STATE_PATH)) {
    throw new Error(
      "Missing Playwright storageState at tests/e2e/.auth/user.json after password login setup.",
    );
  }

  let size = 0;
  try {
    size = statSync(AUTH_STORAGE_STATE_PATH).size;
  } catch {
    throw new Error(
      "tests/e2e/.auth/user.json exists but could not be read. Re-run auth preflight with E2E_USER_EMAIL/PASSWORD.",
    );
  }

  if (size < 2) {
    throw new Error(
      "tests/e2e/.auth/user.json is empty. Re-run auth preflight with E2E_USER_EMAIL/PASSWORD.",
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(AUTH_STORAGE_STATE_PATH, "utf8"));
  } catch {
    throw new Error(
      "tests/e2e/.auth/user.json is not valid JSON. Re-run auth preflight (do not paste session contents into chat).",
    );
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(
      "tests/e2e/.auth/user.json has an invalid top-level shape (expected a Playwright storageState object).",
    );
  }

  const state = parsed as { cookies?: unknown; origins?: unknown };
  const cookieCount = Array.isArray(state.cookies) ? state.cookies.length : 0;
  const originCount = Array.isArray(state.origins) ? state.origins.length : 0;

  if (cookieCount === 0 && originCount === 0) {
    throw new Error(
      "tests/e2e/.auth/user.json has no cookies or origins. Password login did not persist a session.",
    );
  }
}

setup("password login writes gitignored storageState", async ({ page }) => {
  const { email, password } = requireE2ECredentials();

  mkdirSync(path.dirname(AUTH_STORAGE_STATE_PATH), { recursive: true });

  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  const loginAlert = page.getByRole("alert");
  try {
    await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
  } catch {
    const alertText = ((await loginAlert.textContent().catch(() => null)) ?? "").trim();
    throw new Error(
      [
        "Password login failed during auth preflight.",
        alertText ? `UI error: ${alertText}.` : "Still on /login with no alert text.",
        "Verify E2E_USER_EMAIL/PASSWORD for an existing personal-os-dev user with a password.",
        "Do not invent credentials, enable public signup, or bypass Auth.",
      ].join(" "),
    );
  }

  await expect(page.getByRole("link", { name: "Personal OS" })).toBeVisible();

  await page.context().storageState({ path: AUTH_STORAGE_STATE_PATH });
  assertAuthStorageStatePresent();
});
