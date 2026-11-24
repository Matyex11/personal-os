import { expect, test } from "@playwright/test";
import {
  createE2eCurrentChapter,
  enableModulesViaE2eChapterOverrides,
  expectSignedIn,
  openAuthedPage,
  p23Name,
  restorePreviousCurrentChapter,
} from "./helpers";

test.describe("physical metrics vertical slice", () => {
  test.describe.configure({ mode: "serial" });

  const chapterTitle = p23Name("physical-chapter");
  const noteMarker = p23Name("physical-note");

  let previousCurrentTitle: string | null = null;

  test.beforeAll(async ({ browser }) => {
    const { context, page } = await openAuthedPage(browser);
    try {
      const created = await createE2eCurrentChapter(page, chapterTitle);
      previousCurrentTitle = created.previousCurrentTitle;
      await enableModulesViaE2eChapterOverrides(page, chapterTitle, ["physical"]);
    } finally {
      await context.close();
    }
  });

  test.afterAll(async ({ browser }) => {
    const { context, page } = await openAuthedPage(browser);
    try {
      await restorePreviousCurrentChapter(page, previousCurrentTitle, chapterTitle);
    } finally {
      await context.close();
    }
  });

  test("inactive module shows disabled state", async ({ page }) => {
    await page.goto("/chapters");
    await expectSignedIn(page);
    const block = page
      .getByRole("heading", { name: "Current chapter modules" })
      .locator("..")
      .locator("..")
      .locator("div.space-y-2")
      .filter({ hasText: /\bphysical\b/ });
    await block.getByRole("button", { name: "Override inactive" }).click();
    await expect(block.getByText(/physical\s*·\s*Effective:\s*off/i)).toBeVisible({
      timeout: 20_000,
    });

    await page.goto("/physical");
    await expect(
      page.getByRole("heading", { name: "Physical module is inactive", exact: true }),
    ).toBeVisible({ timeout: 15_000 });

    await page.goto("/chapters");
    await block.getByRole("button", { name: "Override active" }).click();
    await expect(block.getByText(/physical\s*·\s*Effective:\s*on/i)).toBeVisible({
      timeout: 20_000,
    });
  });

  test("save a subset of today's metrics and see them after reload", async ({ page }) => {
    await page.goto("/physical");
    await expectSignedIn(page);
    await expect(page.getByRole("heading", { level: 1, name: "Physical", exact: true })).toBeVisible();

    const form = page.locator("form").filter({
      has: page.getByRole("button", { name: /Save measurements|Update measurements/ }),
    });
    await expect(form).toBeVisible({ timeout: 15_000 });
    await form.getByLabel(/Weight \(kg\)/).fill("72.4");
    await form.getByLabel(/Steps \(count\)/).fill("8123");
    await form.getByLabel("Note (optional)").fill(noteMarker);
    await form.getByRole("button", { name: /Save measurements|Update measurements/ }).click();
    await expect(form.getByRole("status")).toContainText("Saved.", { timeout: 20_000 });
    await expect(form.getByRole("alert")).toHaveCount(0);

    await page.reload();
    await expectSignedIn(page);
    await expect(page.getByLabel(/Weight \(kg\)/)).toHaveValue("72.4", { timeout: 15_000 });
    await expect(page.getByLabel(/Steps \(count\)/)).toHaveValue("8123");
    await expect(page.getByLabel("Note (optional)")).toHaveValue(noteMarker);

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Physical snapshot", exact: true })).toBeVisible();
    await expect(page.getByText(/Weight:/)).toBeVisible();
    await expect(page.getByText(/72\.4 kg/)).toBeVisible();
  });
});
