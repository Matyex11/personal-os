import { expect, test } from "@playwright/test";
import {
  captureChapterModuleSources,
  captureGlobalModules,
  createE2eCurrentChapter,
  enableModulesViaE2eChapterOverrides,
  expectSignedIn,
  localIsoDate,
  openAuthedPage,
  p23Name,
  readChapterModuleSource,
  readGlobalModuleOn,
  restoreGlobalModules,
  restorePreviousCurrentChapter,
  type ChapterModuleSource,
} from "./helpers";

test.describe("habits recovery and reporting", () => {
  test.describe.configure({ mode: "serial" });

  const chapterTitle = p23Name("habits-chapter");
  const habitName = p23Name("habit");
  const trackedModules = ["habits"] as const;
  const today = localIsoDate();
  const yesterday = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return localIsoDate(d);
  })();

  let previousCurrentTitle: string | null = null;
  let globalSnapshot = new Map<string, boolean>();
  let priorChapterSources = new Map<string, ChapterModuleSource>();

  test.beforeAll(async ({ browser }) => {
    const { context, page } = await openAuthedPage(browser);
    try {
      globalSnapshot = await captureGlobalModules(page, trackedModules);
      priorChapterSources = await captureChapterModuleSources(page, trackedModules);

      const created = await createE2eCurrentChapter(page, chapterTitle);
      previousCurrentTitle = created.previousCurrentTitle;

      // Chapter override on E2E chapter only — do not flip globals.
      await enableModulesViaE2eChapterOverrides(page, chapterTitle, trackedModules);
    } finally {
      await context.close();
    }
  });

  test.afterAll(async ({ browser }) => {
    const { context, page } = await openAuthedPage(browser);
    try {
      const outcome = await restorePreviousCurrentChapter(
        page,
        previousCurrentTitle,
        chapterTitle,
      );

      if (outcome === "restored_previous" && priorChapterSources.size > 0) {
        await page.goto("/chapters");
        await expectSignedIn(page);
        for (const key of trackedModules) {
          const expected = priorChapterSources.get(key);
          if (expected === undefined) continue;
          expect(await readChapterModuleSource(page, key)).toBe(expected);
        }
      }

      await restoreGlobalModules(page, globalSnapshot);
    } finally {
      await context.close();
    }
  });

  test("create daily habit, log missed, recover, and assert reporting counts", async ({ page }) => {
    // Sanity: globals untouched so far; habits available via e2e chapter override.
    await page.goto("/chapters");
    await expectSignedIn(page);
    expect(await readGlobalModuleOn(page, "habits")).toBe(globalSnapshot.get("habits"));

    await page.goto("/habits");
    await expectSignedIn(page);
    await expect(page.getByRole("heading", { level: 1, name: "Habits", exact: true })).toBeVisible();

    const createForm = page.locator("form").filter({
      has: page.getByRole("button", { name: "Create habit" }),
    });
    await createForm.getByLabel("Name").fill(habitName);
    await createForm.locator("#cadenceKind").selectOption("daily");
    await createForm.getByLabel("Schedule start").fill(yesterday);
    await createForm.getByRole("button", { name: "Create habit" }).click();

    const habitSelect = page.getByLabel("Selected habit");
    await expect(habitSelect).toBeVisible({ timeout: 20_000 });
    await expect(habitSelect.locator("option", { hasText: habitName })).toBeAttached({
      timeout: 20_000,
    });
    await habitSelect.selectOption({ label: habitName });
    const habitId = await habitSelect.inputValue();
    expect(habitId.length).toBeGreaterThan(0);
    await page.goto(
      `/habits?habit=${encodeURIComponent(habitId)}&from=${yesterday}&to=${today}`,
    );
    await expect(page.getByText(new RegExp(`Logging for\\s+${habitName}`))).toBeVisible({
      timeout: 20_000,
    });

    const logForm = page.locator("form").filter({
      has: page.getByRole("button", { name: "Save log" }),
    });
    await logForm.locator("#status").selectOption("missed");
    await logForm.getByLabel("Date").fill(today);
    await logForm.getByRole("button", { name: "Save log" }).click();
    await expect(logForm.getByRole("status")).toContainText(/Log saved/i, { timeout: 20_000 });
    await expect(page.getByText(new RegExp(`${today} · missed`))).toBeVisible({
      timeout: 20_000,
    });

    await logForm.locator("#status").selectOption("recovery");
    const recoverSelect = logForm.locator("#recoversLogId");
    await expect(recoverSelect).toBeVisible({ timeout: 15_000 });
    await expect(recoverSelect.locator("option").nth(1)).toBeAttached({ timeout: 15_000 });
    const firstTarget = await recoverSelect.locator("option").nth(1).getAttribute("value");
    expect(firstTarget).toBeTruthy();
    const firstTargetLabel = (await recoverSelect.locator("option").nth(1).textContent()) ?? "";
    expect(firstTargetLabel).toMatch(new RegExp(`${today}.*missed`, "i"));
    await recoverSelect.selectOption(firstTarget!);
    await logForm.getByLabel("Date").fill(today);
    await logForm.getByRole("button", { name: "Save log" }).click();
    await expect(logForm.getByRole("status")).toContainText(/Log saved/i, { timeout: 20_000 });

    await expect(
      page.getByText(new RegExp(`${today} · recovery → ${today} \\(missed\\)`)),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(new RegExp(`${today} · missed`))).toBeVisible();

    await expect(page.getByRole("heading", { name: "Reporting", exact: true })).toBeVisible();
    await expect(page.getByText(new RegExp(`Adherence · ${habitName}`))).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByText(
        "Counts (denominator = scheduled): scheduled 2 · completed 0 · partial 0 · missed 1 · unlogged 1",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(page.getByText(/Target attainment:.*0%/)).toBeVisible();
    await expect(page.getByText(/Minimum adherence:.*0%/)).toBeVisible();
    await expect(page.getByText("Unlogged scheduled dates", { exact: true })).toBeVisible();
    await expect(page.getByText(yesterday, { exact: true })).toBeVisible();
  });
});
