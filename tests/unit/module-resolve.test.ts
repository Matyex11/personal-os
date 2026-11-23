import { describe, expect, it } from "vitest";
import type { ModuleActivationRow } from "@/lib/db/types";
import {
  isResolvedModuleActive,
  resolveModuleActivations,
} from "@/modules/modules/resolve";

function row(
  partial: Pick<ModuleActivationRow, "scope" | "chapter_id" | "module_key" | "is_active"> & {
    id?: string;
  },
): Pick<ModuleActivationRow, "scope" | "chapter_id" | "module_key" | "is_active"> {
  return {
    scope: partial.scope,
    chapter_id: partial.chapter_id,
    module_key: partial.module_key,
    is_active: partial.is_active,
  };
}

const chapterA = "11111111-1111-1111-1111-111111111111";
const chapterB = "22222222-2222-2222-2222-222222222222";

describe("resolveModuleActivations", () => {
  it("uses chapter override active over global inactive", () => {
    const resolved = resolveModuleActivations(
      [
        row({
          scope: "global",
          chapter_id: null,
          module_key: "habits",
          is_active: false,
        }),
        row({
          scope: "chapter",
          chapter_id: chapterA,
          module_key: "habits",
          is_active: true,
        }),
      ],
      chapterA,
    );
    const habits = resolved.find((m) => m.moduleKey === "habits")!;
    expect(habits.isActive).toBe(true);
    expect(habits.source).toBe("chapter");
  });

  it("uses chapter override inactive over global active", () => {
    const resolved = resolveModuleActivations(
      [
        row({
          scope: "global",
          chapter_id: null,
          module_key: "habits",
          is_active: true,
        }),
        row({
          scope: "chapter",
          chapter_id: chapterA,
          module_key: "habits",
          is_active: false,
        }),
      ],
      chapterA,
    );
    const habits = resolved.find((m) => m.moduleKey === "habits")!;
    expect(habits.isActive).toBe(false);
    expect(habits.source).toBe("chapter");
  });

  it("uses global activation when no chapter override", () => {
    const resolved = resolveModuleActivations(
      [
        row({
          scope: "global",
          chapter_id: null,
          module_key: "tasks",
          is_active: true,
        }),
        row({
          scope: "chapter",
          chapter_id: chapterB,
          module_key: "tasks",
          is_active: false,
        }),
      ],
      chapterA,
    );
    const tasks = resolved.find((m) => m.moduleKey === "tasks")!;
    expect(tasks.isActive).toBe(true);
    expect(tasks.source).toBe("global");
  });

  it("defaults off when no activation rows exist", () => {
    const resolved = resolveModuleActivations([], chapterA);
    expect(resolved.every((m) => m.isActive === false)).toBe(true);
    expect(resolved.every((m) => m.source === "default_off")).toBe(true);
    expect(isResolvedModuleActive(resolved, "habits")).toBe(false);
  });

  it("uses global resolution when no current chapter is provided", () => {
    const resolved = resolveModuleActivations(
      [
        row({
          scope: "global",
          chapter_id: null,
          module_key: "projects",
          is_active: true,
        }),
        row({
          scope: "chapter",
          chapter_id: chapterA,
          module_key: "projects",
          is_active: false,
        }),
      ],
      // no chapterId → ignore chapter overrides
      undefined,
    );
    const projects = resolved.find((m) => m.moduleKey === "projects")!;
    expect(projects.isActive).toBe(true);
    expect(projects.source).toBe("global");
  });

  it("resolves different chapters independently", () => {
    const rows = [
      row({
        scope: "global",
        chapter_id: null,
        module_key: "habits",
        is_active: true,
      }),
      row({
        scope: "chapter",
        chapter_id: chapterA,
        module_key: "habits",
        is_active: false,
      }),
      row({
        scope: "chapter",
        chapter_id: chapterB,
        module_key: "habits",
        is_active: true,
      }),
    ];
    const forA = resolveModuleActivations(rows, chapterA).find((m) => m.moduleKey === "habits")!;
    const forB = resolveModuleActivations(rows, chapterB).find((m) => m.moduleKey === "habits")!;
    expect(forA.isActive).toBe(false);
    expect(forA.source).toBe("chapter");
    expect(forB.isActive).toBe(true);
    expect(forB.source).toBe("chapter");
  });

  it("leaves global resolution unchanged when chapter overrides exist", () => {
    const rows = [
      row({
        scope: "global",
        chapter_id: null,
        module_key: "tasks",
        is_active: true,
      }),
      row({
        scope: "chapter",
        chapter_id: chapterA,
        module_key: "tasks",
        is_active: false,
      }),
    ];
    const globalOnly = resolveModuleActivations(rows);
    const tasks = globalOnly.find((m) => m.moduleKey === "tasks")!;
    expect(tasks.isActive).toBe(true);
    expect(tasks.source).toBe("global");
  });
});
