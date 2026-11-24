import { expect, test, type Page } from "@playwright/test";

/**
 * Live credential cases require shell env. Missing credentials → skip (chromium
 * suite stays green); never invent/hardcode accounts. Auth-preflight remains
 * fail-closed for authenticated projects.
 *
 * Credential-artifact rule: clear password inputs before leaving a failure path
 * so Playwright error-context / screenshots do not retain filled secrets.
 * Do not assert or log credential values.
 */
function e2eCredentials(): { email: string; password: string } | null {
  const email = process.env.E2E_USER_EMAIL?.trim() ?? "";
  const password = process.env.E2E_USER_PASSWORD ?? "";
  if (!email || !password) return null;
  return { email, password };
}

async function clearPasswordInputs(page: Page): Promise<void> {
  const fields = page.locator('input[type="password"]');
  const count = await fields.count();
  for (let i = 0; i < count; i += 1) {
    await fields.nth(i).fill("").catch(() => undefined);
  }
}

async function gotoHydratedLogin(page: Page) {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
  // SSR heading is visible before hydration; wait for client handlers.
  await expect(page.locator('form[data-auth-ready="true"]')).toBeVisible({
    timeout: 15_000,
  });
}

test.describe("password login", () => {
  test("login form defaults to email and password with magic-link fallback", async ({
    page,
  }) => {
    await gotoHydratedLogin(page);
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Use magic link instead" })).toBeVisible();

    await page.getByRole("button", { name: "Use magic link instead" }).click();
    await expect(page.getByRole("button", { name: "Send magic link" })).toBeVisible();
    await expect(page.getByLabel("Password")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Use email and password" })).toBeVisible();
  });

  test("rejects wrong password without creating a session", async ({ page }) => {
    const credentials = e2eCredentials();
    test.skip(
      !credentials,
      "Blocked: set E2E_USER_EMAIL and E2E_USER_PASSWORD (do not invent credentials).",
    );

    await gotoHydratedLogin(page);
    const loginForm = page.locator('form[data-auth-ready="true"]');
    try {
      await page.getByLabel("Email").fill(credentials!.email);
      // Deliberate failure uses a non-secret suffix; clear before test end / on assert fail.
      await page.getByLabel("Password").fill(`${credentials!.password}-wrong`);
      await page.getByRole("button", { name: "Sign in" }).click();

      // Scope to the login form — page-level getByRole("alert") also matches
      // Next.js #__next-route-announcer__ and can resolve ambiguously.
      await expect(loginForm.getByRole("alert")).toContainText(/could not sign in/i);
      await expect(page).toHaveURL(/\/login/);
    } finally {
      await clearPasswordInputs(page);
    }
  });

  test("signs in with email and password", async ({ page }) => {
    const credentials = e2eCredentials();
    test.skip(
      !credentials,
      "Blocked: set E2E_USER_EMAIL and E2E_USER_PASSWORD (do not invent credentials).",
    );

    test.setTimeout(60_000);
    await gotoHydratedLogin(page);
    try {
      await page.getByLabel("Email").fill(credentials!.email);
      await page.getByLabel("Password").fill(credentials!.password);
      await expect(page.getByLabel("Email")).toHaveValue(credentials!.email);
      await page.getByRole("button", { name: "Sign in" }).click();

      await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
      await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    } catch (error) {
      await clearPasswordInputs(page);
      throw error;
    }
  });
});
