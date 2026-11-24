import { expect, test } from "@playwright/test";
import {
  createE2eCurrentChapter,
  enableModulesViaE2eChapterOverrides,
  expectSignedIn,
  openAuthedPage,
  p23Name,
  restorePreviousCurrentChapter,
} from "./helpers";

test.describe("weekly reviews vertical slice", () => {
  test.describe.configure({ mode: "serial" });

  const chapterTitle = p23Name("reviews-chapter");
  const wentWell = p23Name("went-well");

  let previousCurrentTitle: string | null = null;

  test.beforeAll(async ({ browser }) => {
    const { context, page } = await openAuthedPage(browser);
    try {
      const created = await createE2eCurrentChapter(page, chapterTitle);
      previousCurrentTitle = created.previousCurrentTitle;
      await enableModulesViaE2eChapterOverrides(page, chapterTitle, ["reviews"]);
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
      .filter({ hasText: /\breviews\b/ });
    await block.getByRole("button", { name: "Override inactive" }).click();
    await expect(block.getByText(/reviews\s*·\s*Effective:\s*off/i)).toBeVisible({
      timeout: 20_000,
    });

    await page.goto("/reviews");
    await expect(
      page.getByRole("heading", { name: "Reviews module is inactive", exact: true }),
    ).toBeVisible({ timeout: 15_000 });

    await page.goto("/chapters");
    await block.getByRole("button", { name: "Override active" }).click();
    await expect(block.getByText(/reviews\s*·\s*Effective:\s*on/i)).toBeVisible({
      timeout: 20_000,
    });
  });

  test("save draft then complete; completed is sticky after reload", async ({ page }) => {
    await page.goto("/reviews");
    await expectSignedIn(page);
    await expect(page.getByRole("heading", { level: 1, name: "Reviews", exact: true })).toBeVisible();

    // Same user/ISO week may already be sealed from a prior run — reopen first.
    const reopen = page.getByRole("button", { name: "Reopen as draft" });
    if ((await reopen.count()) > 0) {
      await reopen.click();
      await expect(page.getByRole("button", { name: "Save draft" })).toBeVisible({
        timeout: 20_000,
      });
    }

    const draftForm = page.locator("form").filter({
      has: page.getByRole("button", { name: "Save draft" }),
    });
    await expect(draftForm).toBeVisible({ timeout: 15_000 });
    await draftForm.getByLabel("What went well this week?").fill(wentWell);
    await draftForm.getByRole("button", { name: "Save draft" }).click();
    await expect(draftForm.getByRole("status")).toContainText("Saved.", { timeout: 20_000 });
    await expect(draftForm.getByRole("alert")).toHaveCount(0);

    await page.reload();
    await expectSignedIn(page);
    await expect(page.getByLabel("What went well this week?")).toHaveValue(wentWell, {
      timeout: 15_000,
    });

    const completeForm = page.locator("form").filter({
      has: page.getByRole("button", { name: "Complete week" }),
    });
    await completeForm.getByRole("button", { name: "Complete week" }).click();
    await expect(page.getByRole("button", { name: "Reopen as draft" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(wentWell, { exact: true })).toBeVisible();

    await page.reload();
    await expectSignedIn(page);
    await expect(page.getByRole("button", { name: "Reopen as draft" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(wentWell, { exact: true })).toBeVisible();

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Weekly review", exact: true })).toBeVisible();
    await expect(
      page.getByText(/This week('s|’s) review is completed/i),
    ).toBeVisible();
  });
});
