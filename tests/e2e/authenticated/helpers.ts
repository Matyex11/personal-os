import path from "node:path";
import { expect, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";

/** Unique prefix for this Playwright process — keep titles searchable and isolatable. */
export const P23_RUN_ID = `${Date.now().toString(36)}-${process.pid.toString(36)}`;

/** Same gitignored path as playwright.config.ts — required for browser.newContext in beforeAll/afterAll. */
export const AUTH_STORAGE_STATE_PATH = path.join(__dirname, "..", ".auth", "user.json");

/** Open a signed-in page for suite hooks (`browser.newPage()` does not apply project storageState). */
export async function openAuthedPage(
  browser: Browser,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ storageState: AUTH_STORAGE_STATE_PATH });
  const page = await context.newPage();
  return { context, page };
}

export function p23Name(part: string): string {
  return `e2e-p23-${P23_RUN_ID}-${part}`;
}

export function isE2eChapterTitle(title: string): boolean {
  return title.startsWith("e2e-p23-");
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** ISO calendar date in local timezone (YYYY-MM-DD). */
export function localIsoDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function expectSignedIn(page: Page): Promise<void> {
  await expect(page.getByRole("button", { name: "Sign out" }).first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(page).not.toHaveURL(/\/login/);
}

export function globalModuleRow(page: Page, moduleKey: string): Locator {
  return page
    .getByRole("heading", { name: "Global modules" })
    .locator("..")
    .locator("..")
    .locator("div.flex.items-center")
    .filter({ hasText: new RegExp(`^\\s*${escapeRegExp(moduleKey)}\\b`) });
}

export function chapterModuleBlock(page: Page, moduleKey: string): Locator {
  return page
    .getByRole("heading", { name: "Current chapter modules" })
    .locator("..")
    .locator("..")
    .locator("div.space-y-2")
    .filter({ hasText: new RegExp(`\\b${escapeRegExp(moduleKey)}\\b`) });
}

export async function readGlobalModuleOn(page: Page, moduleKey: string): Promise<boolean> {
  const row = globalModuleRow(page, moduleKey);
  await expect(row).toBeVisible({ timeout: 15_000 });
  const text = ((await row.textContent()) ?? "").toLowerCase();
  return /\(on\b/.test(text);
}

/** Capture global on/off for the given keys (must run before any test mutation). */
export async function captureGlobalModules(
  page: Page,
  moduleKeys: readonly string[],
): Promise<Map<string, boolean>> {
  await page.goto("/chapters");
  await expectSignedIn(page);
  const snapshot = new Map<string, boolean>();
  for (const key of moduleKeys) {
    snapshot.set(key, await readGlobalModuleOn(page, key));
  }
  return snapshot;
}

export async function setGlobalModule(
  page: Page,
  moduleKey: string,
  active: boolean,
): Promise<void> {
  await page.goto("/chapters");
  await expectSignedIn(page);
  const row = globalModuleRow(page, moduleKey);
  await expect(row).toBeVisible({ timeout: 15_000 });
  const currentlyOn = await readGlobalModuleOn(page, moduleKey);
  if (currentlyOn === active) return;
  const label = active ? "Enable" : "Disable";
  await row.getByRole("button", { name: label }).click();
  await expect(row.getByRole("button", { name: active ? "Disable" : "Enable" })).toBeVisible({
    timeout: 20_000,
  });
  expect(await readGlobalModuleOn(page, moduleKey)).toBe(active);
}

/**
 * Restore globals to a previously captured snapshot via Enable/Disable only.
 * Verifies each key afterward. Does not invent a historical pre-capture state.
 */
export async function restoreGlobalModules(
  page: Page,
  snapshot: ReadonlyMap<string, boolean>,
): Promise<void> {
  for (const [key, desired] of snapshot) {
    await setGlobalModule(page, key, desired);
  }
  await page.goto("/chapters");
  await expectSignedIn(page);
  for (const [key, desired] of snapshot) {
    expect(await readGlobalModuleOn(page, key), `global ${key} after restore`).toBe(desired);
  }
}

export type ChapterModuleSource = "chapter" | "global" | "default_off" | "unknown";

/** Read resolved source label for a module on the *current* chapter panel. */
export async function readChapterModuleSource(
  page: Page,
  moduleKey: string,
): Promise<ChapterModuleSource> {
  const block = chapterModuleBlock(page, moduleKey);
  await expect(block).toBeVisible({ timeout: 15_000 });
  const text = ((await block.textContent()) ?? "").toLowerCase();
  if (/chapter override/.test(text) || /explicit chapter override/.test(text)) return "chapter";
  if (/·\s*global\b/.test(text) || /inherited[\s\S]*global/.test(text)) return "global";
  if (/default off/.test(text)) return "default_off";
  return "unknown";
}

export async function captureChapterModuleSources(
  page: Page,
  moduleKeys: readonly string[],
): Promise<Map<string, ChapterModuleSource>> {
  await page.goto("/chapters");
  await expectSignedIn(page);
  // No current chapter → nothing to capture (caller handles).
  if (
    (await page.getByRole("heading", { name: "No current chapter", exact: true }).count()) > 0
  ) {
    return new Map();
  }
  const snapshot = new Map<string, ChapterModuleSource>();
  for (const key of moduleKeys) {
    snapshot.set(key, await readChapterModuleSource(page, key));
  }
  return snapshot;
}

/** Read the current chapter title from an already-loaded /chapters page. */
export async function readCurrentChapterTitleFromPage(page: Page): Promise<string | null> {
  const currentHeading = page.getByRole("heading").filter({ hasText: /· current\s*$/ });
  if ((await currentHeading.count()) === 0) return null;
  const text = (await currentHeading.first().textContent()) ?? "";
  return text.replace(/\s*·\s*current\s*$/i, "").trim() || null;
}

export async function readCurrentChapterTitle(page: Page): Promise<string | null> {
  await page.goto("/chapters");
  await expectSignedIn(page);
  return readCurrentChapterTitleFromPage(page);
}

/**
 * Create an active+current E2E chapter. Returns the prior current title (if any).
 * Does not touch module globals or overrides.
 */
export async function createE2eCurrentChapter(
  page: Page,
  chapterTitle: string,
): Promise<{ previousCurrentTitle: string | null }> {
  if (!isE2eChapterTitle(chapterTitle)) {
    throw new Error(`Refusing non-e2e chapter title: ${chapterTitle}`);
  }

  await page.goto("/chapters");
  await expectSignedIn(page);

  const previousCurrentTitle = await readCurrentChapterTitleFromPage(page);

  const form = page.locator("form").filter({ has: page.getByLabel("Title") }).filter({
    has: page.getByRole("button", { name: "Create chapter" }),
  });
  await form.getByLabel("Title").fill(chapterTitle);
  await form.getByLabel("Started on").fill(localIsoDate());
  await form.locator("#status").selectOption("active");
  const markCurrent = form.locator('input[name="isCurrent"]');
  if (!(await markCurrent.isChecked())) {
    await markCurrent.check();
  }
  await form.getByRole("button", { name: "Create chapter" }).click();

  await expect(
    page.getByRole("heading", {
      name: new RegExp(`${escapeRegExp(chapterTitle)}\\s*·\\s*current`),
    }),
  ).toBeVisible({ timeout: 20_000 });

  return { previousCurrentTitle };
}

export type RestoreCurrentOutcome =
  | "restored_previous"
  | "no_previous_current"
  | "previous_unavailable";

/** Make the prior chapter current again when Make current is still available. */
export async function restorePreviousCurrentChapter(
  page: Page,
  previousCurrentTitle: string | null,
  e2eChapterTitle: string,
): Promise<RestoreCurrentOutcome> {
  await page.goto("/chapters");
  await expectSignedIn(page);

  if (!previousCurrentTitle || previousCurrentTitle === e2eChapterTitle) {
    return "no_previous_current";
  }

  const previousCard = page
    .getByRole("heading", { name: previousCurrentTitle, exact: true })
    .locator("../..");
  const makeCurrent = previousCard.getByRole("button", { name: "Make current" });

  if ((await makeCurrent.count()) === 0) {
    return "previous_unavailable";
  }

  await makeCurrent.click();
  await expect(
    page.getByRole("heading", {
      name: new RegExp(`${escapeRegExp(previousCurrentTitle)}\\s*·\\s*current`),
    }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(
    page.getByRole("heading", {
      name: new RegExp(`${escapeRegExp(e2eChapterTitle)}\\s*·\\s*current`),
    }),
  ).toHaveCount(0);

  return "restored_previous";
}

/**
 * Set a chapter override only when the current chapter is the expected E2E chapter.
 * Refuses to mutate overrides on a pre-existing / non-matching chapter.
 * Note: app cannot clear overrides back to inherit (no DELETE) — callers must only
 * create overrides on throwaway e2e chapters.
 */
export async function setChapterModuleOverride(
  page: Page,
  moduleKey: string,
  active: boolean,
  options: { expectedChapterTitle: string },
): Promise<void> {
  const { expectedChapterTitle } = options;
  if (!isE2eChapterTitle(expectedChapterTitle)) {
    throw new Error(
      `Refusing chapter override on non-e2e chapter "${expectedChapterTitle}" (no inherit-clear path).`,
    );
  }

  await page.goto("/chapters");
  await expectSignedIn(page);

  const currentTitle = await readCurrentChapterTitleFromPage(page);
  if (currentTitle !== expectedChapterTitle) {
    throw new Error(
      `Refusing chapter override: current chapter is "${currentTitle ?? "(none)"}", expected e2e "${expectedChapterTitle}".`,
    );
  }

  await expect(
    page.getByText(
      new RegExp(`Overrides for current chapter\\s+${escapeRegExp(expectedChapterTitle)}`),
    ),
  ).toBeVisible({ timeout: 15_000 });

  const block = chapterModuleBlock(page, moduleKey);
  await expect(block).toBeVisible({ timeout: 15_000 });
  const label = active ? "Override active" : "Override inactive";
  await block.getByRole("button", { name: label }).click();
  await expect(
    block.getByText(
      new RegExp(`${escapeRegExp(moduleKey)}\\s*·\\s*Effective:\\s*${active ? "on" : "off"}`, "i"),
    ),
  ).toBeVisible({ timeout: 20_000 });
}

/**
 * Prefer chapter-level active overrides on an E2E chapter so workflows work without
 * permanently flipping globals. Globals are left at the captured snapshot.
 */
export async function enableModulesViaE2eChapterOverrides(
  page: Page,
  expectedChapterTitle: string,
  moduleKeys: readonly string[],
): Promise<void> {
  for (const key of moduleKeys) {
    await setChapterModuleOverride(page, key, true, { expectedChapterTitle });
  }
}
