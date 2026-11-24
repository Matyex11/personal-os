import { expect, test } from "@playwright/test";
import { expectSignedIn } from "./helpers";

/**
 * Real authenticated smoke — storageState must yield a live session, not just a file on disk.
 */
test.describe("authenticated smoke", () => {
  test.describe.configure({ mode: "serial" });

  test("home shell is signed in (not redirected to login)", async ({ page }) => {
    await page.goto("/");
    await expectSignedIn(page);
    await expect(page.getByRole("link", { name: "Personal OS" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  });

  test("settings session card shows authenticated", async ({ page }) => {
    await page.goto("/settings");
    await expectSignedIn(page);
    await expect(page.getByRole("heading", { name: "Session", exact: true })).toBeVisible();
    await expect(page.getByText("authenticated", { exact: true })).toBeVisible();
    // Email value is present but never asserted/logged (avoid secrets in reports).
    await expect(page.getByText("Email", { exact: true })).toBeVisible();
  });
});
