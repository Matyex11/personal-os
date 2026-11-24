import { expect, test } from "@playwright/test";
import { expectSignedIn, p23Name } from "./helpers";

test.describe("profile settings", () => {
  test.describe.configure({ mode: "serial" });

  test("updates display name then restores prior value; leaves tz/currency alone", async ({
    page,
  }) => {
    await page.goto("/settings");
    await expectSignedIn(page);

    const displayName = page.getByLabel("Display name");
    const timezone = page.getByLabel("Timezone");
    const currency = page.getByLabel("Base currency");
    await expect(displayName).toBeVisible();
    await expect(timezone).toBeVisible();
    await expect(currency).toBeVisible();

    const original = await displayName.inputValue();
    const originalTimezone = await timezone.inputValue();
    const originalCurrency = await currency.inputValue();
    const marker = p23Name("profile");

    const profileForm = page.locator("form").filter({
      has: page.getByRole("button", { name: "Save profile" }),
    });

    try {
      await displayName.fill(marker);
      // Do not modify timezone or currency — leave selected values as-is.
      await expect(timezone).toHaveValue(originalTimezone);
      await expect(currency).toHaveValue(originalCurrency);
      await profileForm.getByRole("button", { name: "Save profile" }).click();
      await expect(profileForm.getByRole("status")).toContainText(/Profile settings saved/i, {
        timeout: 20_000,
      });

      await page.reload();
      await expectSignedIn(page);
      await expect(page.getByLabel("Display name")).toHaveValue(marker);
      await expect(page.getByLabel("Timezone")).toHaveValue(originalTimezone);
      await expect(page.getByLabel("Base currency")).toHaveValue(originalCurrency);
    } finally {
      await page.goto("/settings");
      await expectSignedIn(page);
      const form = page.locator("form").filter({
        has: page.getByRole("button", { name: "Save profile" }),
      });
      const field = page.getByLabel("Display name");
      await field.fill(original);
      await expect(page.getByLabel("Timezone")).toHaveValue(originalTimezone);
      await expect(page.getByLabel("Base currency")).toHaveValue(originalCurrency);
      await form.getByRole("button", { name: "Save profile" }).click();
      await expect(form.getByRole("status")).toContainText(/Profile settings saved/i, {
        timeout: 20_000,
      });
      await page.reload();
      await expectSignedIn(page);
      // Verify restoration succeeded (not only that save was acknowledged).
      await expect(page.getByLabel("Display name")).toHaveValue(original);
      await expect(page.getByLabel("Timezone")).toHaveValue(originalTimezone);
      await expect(page.getByLabel("Base currency")).toHaveValue(originalCurrency);
    }
  });
});
