import { expect, test } from "@playwright/test";

test.describe("app shell navigation", () => {
  test("renders dashboard and navigates primary routes", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Personal OS" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
    await expect(page.getByText("No data connected")).toBeVisible();

    await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Chapters" }).click();
    await expect(page).toHaveURL(/\/chapters$/);
    await expect(page.getByRole("heading", { name: "Chapters", exact: true })).toBeVisible();

    await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Habits" }).click();
    await expect(page).toHaveURL(/\/habits$/);
    await expect(page.getByRole("heading", { name: "Habits", exact: true })).toBeVisible();

    await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Projects" }).click();
    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();

    await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Settings" }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
    await expect(page.getByText("anonymous", { exact: true })).toBeVisible();
  });
});
