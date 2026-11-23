import type { ModuleActivationRow } from "@/lib/db/types";
import type { ModuleKey } from "@/types/domain";

export const MODULE_KEYS = [
  "habits",
  "tasks",
  "projects",
  "milestones",
  "checkins",
  "finances",
  "physical",
  "behavioural",
  "reviews",
  "xnine_tracking",
] as const satisfies readonly ModuleKey[];

export type ResolvedModuleKey = (typeof MODULE_KEYS)[number];

export type ResolvedModuleActivation = {
  moduleKey: ResolvedModuleKey;
  isActive: boolean;
  source: "chapter" | "global" | "default_off";
};

type ActivationRowInput = Pick<
  ModuleActivationRow,
  "scope" | "chapter_id" | "module_key" | "is_active"
>;

/**
 * Authoritative resolution: chapter override → global → default off.
 * Shared by listModuleActivations — do not fork this order elsewhere.
 */
export function resolveModuleActivations(
  rows: ActivationRowInput[],
  chapterId?: string,
): ResolvedModuleActivation[] {
  return MODULE_KEYS.map((key) => {
    const chapterOverride = chapterId
      ? rows.find(
          (row) =>
            row.scope === "chapter" &&
            row.chapter_id === chapterId &&
            row.module_key === key,
        )
      : undefined;
    const global = rows.find((row) => row.scope === "global" && row.module_key === key);
    const chosen = chapterOverride ?? global;
    return {
      moduleKey: key,
      isActive: chosen?.is_active ?? false,
      source: chosen?.scope ?? ("default_off" as const),
    };
  });
}

export function isResolvedModuleActive(
  resolved: ResolvedModuleActivation[],
  moduleKey: ResolvedModuleKey,
): boolean {
  return resolved.find((row) => row.moduleKey === moduleKey)?.isActive ?? false;
}
