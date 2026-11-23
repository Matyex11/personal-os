import { expect, test } from "@playwright/test";

test.describe("auth gate and public shell", () => {
  test("unauthenticated visitors are sent to login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Use magic link instead" })).toBeVisible();
  });

  test("login page exposes Personal OS brand", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("link", { name: "Personal OS" })).toBeVisible();
  });
});
