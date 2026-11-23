import { expect, test } from "@playwright/test";
import { PASSWORD_MIN_LENGTH } from "../../../src/lib/auth/password";

/**
 * Authenticated password set/change via Settings → updateUser.
 * Uses the existing E2E password so the account is not rotated away from secrets.
 * Never invents a replacement password when env is missing or too short.
 */
test.describe("password setting", () => {
  test("settings exposes password form and validates mismatch", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Password", exact: true })).toBeVisible();
    await expect(page.getByLabel("New password")).toBeVisible();
    await expect(page.getByLabel("Confirm password")).toBeVisible();

    const left = "a".repeat(PASSWORD_MIN_LENGTH);
    const right = "b".repeat(PASSWORD_MIN_LENGTH);
    await page.getByLabel("New password").fill(left);
    await page.getByLabel("Confirm password").fill(right);
    await page.getByRole("button", { name: "Save password" }).click();

    await expect(page.getByRole("alert")).toContainText(/passwords do not match/i);
  });

  test("authenticated user can save password via updateUser", async ({ page }) => {
    const password = process.env.E2E_USER_PASSWORD ?? "";
    if (!password) {
      throw new Error(
        [
          "Blocked: missing E2E_USER_PASSWORD after auth-preflight.",
          "Do not invent a password in tests. Export E2E_USER_EMAIL/PASSWORD and re-run.",
        ].join(" "),
      );
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
      throw new Error(
        [
          `Blocked: E2E_USER_PASSWORD is shorter than PASSWORD_MIN_LENGTH (${PASSWORD_MIN_LENGTH}).`,
          "Set a compliant password on the dedicated DEV user via Settings.",
          "Do not invent or pad a replacement secret in tests.",
        ].join(" "),
      );
    }

    await page.goto("/settings");
    await page.getByLabel("New password").fill(password);
    await page.getByLabel("Confirm password").fill(password);
    await page.getByRole("button", { name: "Save password" }).click();

    const status = page.getByRole("status");
    const alert = page.getByRole("alert");

    await expect(status.or(alert)).toBeVisible({ timeout: 30_000 });

    const alertText = (await alert.textContent().catch(() => null)) ?? "";

    if (/re-?auth|recent sign-in/i.test(alertText)) {
      throw new Error(
        [
          "Password update blocked by Supabase reauthentication requirement.",
          "Do not weaken Auth settings from the agent.",
          "Human: complete a fresh sign-in, then retry Settings password save,",
          "or review hosted Auth “secure password change” / reauth policy deliberately.",
        ].join(" "),
      );
    }

    await expect(status).toContainText(/password saved/i);
    expect(alertText).toBe("");
  });
});
