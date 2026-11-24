import { expect, test, type Locator, type Page } from "@playwright/test";
import { PASSWORD_MIN_LENGTH } from "../../../src/lib/auth/password";

/**
 * Authenticated Settings → Password UI validation only.
 * Live Auth updateUser is covered by mocked PasswordSettingsForm unit tests —
 * Supabase rejects same_password updates, and e2e must not rotate or invent secrets.
 *
 * Credential-artifact rule: clear password inputs after the deliberate client-side
 * mismatch assertion so failure screenshots / error-context cannot retain filled values.
 * Uses synthetic local strings only — never E2E_USER_PASSWORD.
 */
test.describe("password setting", () => {
  function passwordForm(page: Page): Locator {
    return page.locator("form").filter({ has: page.getByLabel("New password") });
  }

  async function clearPasswordFields(page: Page): Promise<void> {
    const fields = page.locator('input[type="password"]');
    const count = await fields.count();
    for (let i = 0; i < count; i += 1) {
      await fields.nth(i).fill("").catch(() => undefined);
    }
  }

  test("settings exposes password form and validates mismatch", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Password", exact: true })).toBeVisible();
    await expect(page.getByLabel("New password")).toBeVisible();
    await expect(page.getByLabel("Confirm password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save password" })).toBeVisible();

    const form = passwordForm(page);
    const left = "a".repeat(PASSWORD_MIN_LENGTH);
    const right = "b".repeat(PASSWORD_MIN_LENGTH);
    try {
      await page.getByLabel("New password").fill(left);
      await page.getByLabel("Confirm password").fill(right);
      await page.getByRole("button", { name: "Save password" }).click();

      // Scope to the password form — page-level getByRole("alert") also matches
      // Next.js #__next-route-announcer__ (strict-mode ambiguity).
      await expect(form.getByRole("alert")).toContainText(/passwords do not match/i);
    } finally {
      await clearPasswordFields(page);
    }
  });
});
