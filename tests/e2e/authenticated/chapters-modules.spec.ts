import { expect, test } from "@playwright/test";
import {
  captureChapterModuleSources,
  captureGlobalModules,
  createE2eCurrentChapter,
  escapeRegExp,
  expectSignedIn,
  openAuthedPage,
  p23Name,
  readChapterModuleSource,
  readGlobalModuleOn,
  restoreGlobalModules,
  restorePreviousCurrentChapter,
  setChapterModuleOverride,
  type ChapterModuleSource,
} from "./helpers";

test.describe("chapters and modules", () => {
  test.describe.configure({ mode: "serial" });

  const chapterTitle = p23Name("chapter");
  const trackedModules = ["habits"] as const;

  let previousCurrentTitle: string | null = null;
  let globalSnapshot = new Map<string, boolean>();
  let priorChapterSources = new Map<string, ChapterModuleSource>();
  let restoreOutcome: string = "skipped";

  test.beforeAll(async ({ browser }) => {
    const { context, page } = await openAuthedPage(browser);
    try {
      // Capture globals and prior-chapter override sources BEFORE any mutation.
      globalSnapshot = await captureGlobalModules(page, trackedModules);
      priorChapterSources = await captureChapterModuleSources(page, trackedModules);
    } finally {
      await context.close();
    }
  });

  test.afterAll(async ({ browser }) => {
    const { context, page } = await openAuthedPage(browser);
    try {
      // Globals must match capture (this suite does not flip them; restore is idempotent).
      await restoreGlobalModules(page, globalSnapshot);
    } finally {
      await context.close();
    }
  });

  test("create active current chapter; previous current is displaced", async ({ page }) => {
    const created = await createE2eCurrentChapter(page, chapterTitle);
    previousCurrentTitle = created.previousCurrentTitle;

    if (previousCurrentTitle && previousCurrentTitle !== chapterTitle) {
      await expect(
        page.getByRole("heading", { name: previousCurrentTitle, exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", {
          name: new RegExp(`^\\s*${escapeRegExp(previousCurrentTitle)}\\s*·\\s*current`),
        }),
      ).toHaveCount(0);
      const previousCard = page
        .getByRole("heading", { name: previousCurrentTitle, exact: true })
        .locator("../..");
      await expect(previousCard.getByRole("button", { name: "Make current" })).toBeVisible();
    }
  });

  test("chapter habits override gates /habits without flipping global", async ({ page }) => {
    await page.goto("/chapters");
    await expectSignedIn(page);

    const globalBefore = await readGlobalModuleOn(page, "habits");
    expect(globalBefore).toBe(globalSnapshot.get("habits"));

    // Overrides only on this suite's e2e chapter (guarded by expectedChapterTitle).
    await setChapterModuleOverride(page, "habits", false, { expectedChapterTitle: chapterTitle });
    await page.goto("/habits");
    await expect(
      page.getByRole("heading", { name: "Habits module is inactive", exact: true }),
    ).toBeVisible({ timeout: 15_000 });

    await setChapterModuleOverride(page, "habits", true, { expectedChapterTitle: chapterTitle });
    await page.goto("/habits");
    await expect(page.getByRole("heading", { level: 1, name: "Habits", exact: true })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Habits module is inactive", exact: true }),
    ).toHaveCount(0);

    await page.goto("/chapters");
    const globalAfter = await readGlobalModuleOn(page, "habits");
    expect(globalAfter).toBe(globalBefore);
    expect(globalAfter).toBe(globalSnapshot.get("habits"));
  });

  test("restore previous current; prior chapter override sources unchanged", async ({ page }) => {
    restoreOutcome = await restorePreviousCurrentChapter(
      page,
      previousCurrentTitle,
      chapterTitle,
    );

    if (restoreOutcome === "restored_previous" && priorChapterSources.size > 0) {
      await page.goto("/chapters");
      await expectSignedIn(page);
      for (const key of trackedModules) {
        const expected = priorChapterSources.get(key);
        if (expected === undefined) continue;
        const actual = await readChapterModuleSource(page, key);
        expect(actual, `pre-existing chapter source for ${key}`).toBe(expected);
      }
    }

    if (restoreOutcome === "no_previous_current" || restoreOutcome === "previous_unavailable") {
      await expect(
        page.getByRole("heading", {
          name: new RegExp(`${escapeRegExp(chapterTitle)}\\s*·\\s*current`),
        }),
      ).toBeVisible();
    } else {
      await expect(page.getByRole("heading", { name: chapterTitle, exact: true })).toBeVisible();
    }

    // Globals still match capture.
    expect(await readGlobalModuleOn(page, "habits")).toBe(globalSnapshot.get("habits"));
  });
});
