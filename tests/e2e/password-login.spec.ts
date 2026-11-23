import { expect, test } from "@playwright/test";

/**
 * Live credential cases require shell env. Missing credentials → skip (chromium
 * suite stays green); never invent/hardcode accounts. Auth-preflight remains
 * fail-closed for authenticated projects.
 */
function e2eCredentials(): { email: string; password: string } | null {
  const email = process.env.E2E_USER_EMAIL?.trim() ?? "";
  const password = process.env.E2E_USER_PASSWORD ?? "";
  if (!email || !password) return null;
  return { email, password };
}

test.describe("password login", () => {
  test("login form defaults to email and password with magic-link fallback", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
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

    await page.goto("/login");
    await page.getByLabel("Email").fill(credentials!.email);
    await page.getByLabel("Password").fill(`${credentials!.password}-wrong`);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByRole("alert")).toContainText(/could not sign in/i);
    await expect(page).toHaveURL(/\/login/);
  });

  test("signs in with email and password", async ({ page }) => {
    const credentials = e2eCredentials();
    test.skip(
      !credentials,
      "Blocked: set E2E_USER_EMAIL and E2E_USER_PASSWORD (do not invent credentials).",
    );

    await page.goto("/login");
    await page.getByLabel("Email").fill(credentials!.email);
    await page.getByLabel("Password").fill(credentials!.password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
    await expect(page.getByRole("link", { name: "Personal OS" })).toBeVisible();
  });
});
