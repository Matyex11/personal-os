import { expect, test } from "@playwright/test";
import {
  createE2eCurrentChapter,
  enableModulesViaE2eChapterOverrides,
  expectSignedIn,
  openAuthedPage,
  p23Name,
  restorePreviousCurrentChapter,
} from "./helpers";

test.describe("check-ins vertical slice", () => {
  test.describe.configure({ mode: "serial" });

  const chapterTitle = p23Name("checkins-chapter");
  const noteMarker = p23Name("checkin-note");

  let previousCurrentTitle: string | null = null;

  test.beforeAll(async ({ browser }) => {
    const { context, page } = await openAuthedPage(browser);
    try {
      const created = await createE2eCurrentChapter(page, chapterTitle);
      previousCurrentTitle = created.previousCurrentTitle;
      await enableModulesViaE2eChapterOverrides(page, chapterTitle, ["checkins"]);
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

  test("inactive module shows disabled state when override off", async ({ page }) => {
    await page.goto("/chapters");
    await expectSignedIn(page);
    // Toggle off only on this suite's e2e chapter.
    const block = page
      .getByRole("heading", { name: "Current chapter modules" })
      .locator("..")
      .locator("..")
      .locator("div.space-y-2")
      .filter({ hasText: /\bcheckins\b/ });
    await block.getByRole("button", { name: "Override inactive" }).click();
    await expect(
      block.getByText(/checkins\s*·\s*Effective:\s*off/i),
    ).toBeVisible({ timeout: 20_000 });

    await page.goto("/check-ins");
    await expect(
      page.getByRole("heading", { name: "Check-ins module is inactive", exact: true }),
    ).toBeVisible({ timeout: 15_000 });

    await page.goto("/chapters");
    await block.getByRole("button", { name: "Override active" }).click();
    await expect(
      block.getByText(/checkins\s*·\s*Effective:\s*on/i),
    ).toBeVisible({ timeout: 20_000 });
  });

  test("submit today scores and see them after reload", async ({ page }) => {
    await page.goto("/check-ins");
    await expectSignedIn(page);
    await expect(page.getByRole("heading", { level: 1, name: "Check-ins", exact: true })).toBeVisible();

    const form = page.locator("form").filter({
      has: page.getByRole("button", { name: /Save check-in|Update today/ }),
    });
    await form.getByLabel("Mood (1–5)").selectOption("4");
    await form.getByLabel("Energy (1–5)").selectOption("3");
    await form.getByLabel("Focus (1–5)").selectOption("5");
    await form.getByLabel("Note (optional)").fill(noteMarker);
    await form.getByRole("button", { name: /Save check-in|Update today/ }).click();
    await expect(form.getByRole("status")).toContainText("Saved.", { timeout: 20_000 });
    await expect(form.getByRole("alert")).toHaveCount(0);

    await page.reload();
    await expectSignedIn(page);
    await expect(page.getByRole("heading", { name: /Today \(/ })).toBeVisible({ timeout: 15_000 });

    // Scope to today's form — history rows also expose Mood/Energy/Focus labels.
    const todayForm = page.locator("form").filter({
      has: page.getByRole("button", { name: /Save check-in|Update today/ }),
    });
    await expect(todayForm.getByLabel("Mood (1–5)")).toHaveValue("4");
    await expect(todayForm.getByLabel("Energy (1–5)")).toHaveValue("3");
    await expect(todayForm.getByLabel("Focus (1–5)")).toHaveValue("5");
    await expect(todayForm.getByLabel("Note (optional)")).toHaveValue(noteMarker);

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Today's check-in", exact: true })).toBeVisible();
    await expect(page.getByText(/mood 4 · energy 3 · focus 5/)).toBeVisible();
  });
});
