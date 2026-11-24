import { expect, test } from "@playwright/test";
import {
  captureChapterModuleSources,
  captureGlobalModules,
  createE2eCurrentChapter,
  enableModulesViaE2eChapterOverrides,
  expectSignedIn,
  openAuthedPage,
  p23Name,
  readChapterModuleSource,
  readGlobalModuleOn,
  restoreGlobalModules,
  restorePreviousCurrentChapter,
  type ChapterModuleSource,
} from "./helpers";

test.describe("projects hierarchy", () => {
  test.describe.configure({ mode: "serial" });

  const chapterTitle = p23Name("projects-chapter");
  const projectTitle = p23Name("project");
  const milestoneTitle = p23Name("milestone");
  const taskTitle = p23Name("task");
  const trackedModules = ["projects", "milestones", "tasks"] as const;

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

      // Overrides only on this suite's e2e chapter — globals left at snapshot.
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

  test("create project → milestone → task, change status, verify persistence", async ({ page }) => {
    await page.goto("/chapters");
    await expectSignedIn(page);
    for (const key of trackedModules) {
      expect(await readGlobalModuleOn(page, key)).toBe(globalSnapshot.get(key));
    }

    await page.goto("/projects");
    await expectSignedIn(page);
    await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Projects workspace is inactive", exact: true }),
    ).toHaveCount(0);

    const projectForm = page.locator("form").filter({
      has: page.getByRole("button", { name: "Create project" }),
    });
    await projectForm.getByLabel("Title").fill(projectTitle);
    await projectForm.getByRole("button", { name: "Create project" }).click();
    await expect(page.getByText(projectTitle).first()).toBeVisible({ timeout: 20_000 });

    const milestoneForm = page.locator("form").filter({
      has: page.getByRole("button", { name: "Create milestone" }),
    });
    await milestoneForm.getByLabel("Title").fill(milestoneTitle);
    const projectSelect = milestoneForm.locator("#mproject");
    await expect(projectSelect.locator("option", { hasText: projectTitle })).toBeAttached({
      timeout: 20_000,
    });
    await projectSelect.selectOption({ label: projectTitle });
    await milestoneForm.getByRole("button", { name: "Create milestone" }).click();
    await expect(page.getByText(milestoneTitle).first()).toBeVisible({ timeout: 20_000 });

    const taskForm = page.locator("form").filter({
      has: page.getByRole("button", { name: "Create task" }),
    });
    await taskForm.getByLabel("Title").fill(taskTitle);
    await taskForm.locator("#tproject").selectOption({ label: projectTitle });
    await expect(taskForm.locator("#tmilestone").locator("option", { hasText: milestoneTitle })).toBeAttached({
      timeout: 20_000,
    });
    await taskForm.locator("#tmilestone").selectOption({ label: milestoneTitle });
    await taskForm.getByRole("button", { name: "Create task" }).click();
    await expect(page.getByText(taskTitle).first()).toBeVisible({ timeout: 20_000 });

    await expect(page.getByRole("heading", { name: "Workspace", exact: true })).toBeVisible();
    const workspace = page
      .getByRole("heading", { name: "Workspace", exact: true })
      .locator("..")
      .locator("..");
    await expect(workspace.getByText(projectTitle).first()).toBeVisible();
    await expect(workspace.getByText(milestoneTitle).first()).toBeVisible();
    await expect(workspace.getByText(taskTitle).first()).toBeVisible();

    const taskRow = workspace.locator("li").filter({ hasText: taskTitle }).first();
    await expect(taskRow.getByText(/·\s*todo/)).toBeVisible();
    const statusForm = taskRow.locator("form").filter({
      has: page.getByRole("button", { name: "Set task" }),
    });
    await statusForm.getByLabel("Status").selectOption("doing");
    await statusForm.getByRole("button", { name: "Set task" }).click();
    await expect(statusForm.getByRole("status")).toContainText(/Saved/i, { timeout: 20_000 });
    await expect(taskRow.getByText(/·\s*doing/)).toBeVisible({ timeout: 20_000 });

    await page.reload();
    await expectSignedIn(page);
    const workspaceAfter = page
      .getByRole("heading", { name: "Workspace", exact: true })
      .locator("..")
      .locator("..");
    const taskRowAfter = workspaceAfter.locator("li").filter({ hasText: taskTitle }).first();
    await expect(taskRowAfter.getByText(taskTitle)).toBeVisible({ timeout: 20_000 });
    await expect(taskRowAfter.getByText(/·\s*doing/)).toBeVisible();

    await page.goto("/");
    await expectSignedIn(page);
    await page.goto("/projects");
    await expectSignedIn(page);
    const workspaceBack = page
      .getByRole("heading", { name: "Workspace", exact: true })
      .locator("..")
      .locator("..");
    await expect(workspaceBack.getByText(projectTitle).first()).toBeVisible();
    await expect(workspaceBack.getByText(milestoneTitle).first()).toBeVisible();
    await expect(
      workspaceBack.locator("li").filter({ hasText: taskTitle }).getByText(/·\s*doing/),
    ).toBeVisible();
  });
});
