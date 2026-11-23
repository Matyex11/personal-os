import { ActionForm } from "@/components/forms/action-form";
import { upsertModuleAction } from "@/app/actions/domain";
import type { ResolvedModuleActivation } from "@/modules/modules/resolve";

type ChapterModuleOverridesProps = {
  chapterId: string;
  chapterTitle: string;
  chapterResolved: ResolvedModuleActivation[];
  globalResolved: ResolvedModuleActivation[];
};

function sourceLabel(source: ResolvedModuleActivation["source"]): string {
  switch (source) {
    case "chapter":
      return "Chapter override";
    case "global":
      return "Global";
    default:
      return "Default off";
  }
}

export function ChapterModuleOverrides({
  chapterId,
  chapterTitle,
  chapterResolved,
  globalResolved,
}: ChapterModuleOverridesProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Overrides for current chapter{" "}
        <span className="font-medium text-foreground">{chapterTitle}</span>. Resolution:
        chapter override → global → default off. Explicit overrides can be set to active or
        inactive; clearing back to inherit is not available (no delete path for activations).
      </p>
      {chapterResolved.map((module) => {
        const global = globalResolved.find((row) => row.moduleKey === module.moduleKey);
        const globalActive = global?.isActive ?? false;
        const differsFromGlobal = module.isActive !== globalActive;
        const isExplicitOverride = module.source === "chapter";

        return (
          <div
            key={module.moduleKey}
            className="space-y-2 border-b border-border pb-3 last:border-b-0 last:pb-0"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span>
                <span className="font-medium">{module.moduleKey}</span>{" "}
                <span className="text-muted-foreground">
                  · Effective: {module.isActive ? "on" : "off"} · {sourceLabel(module.source)}
                </span>
              </span>
              <span className="text-xs text-muted-foreground">
                Global: {globalActive ? "on" : "off"}
                {global?.source === "default_off" ? " (default)" : ""}
              </span>
            </div>

            {isExplicitOverride ? (
              <p className="text-xs text-muted-foreground" role="status">
                Explicit chapter override (not inherited).
                {differsFromGlobal
                  ? ` Differs from global (${globalActive ? "on" : "off"}).`
                  : " Matches global value, but remains an explicit override until cleared."}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground" role="status">
                Inherited — no chapter override row. Effective state comes from{" "}
                {sourceLabel(module.source).toLowerCase()}.
              </p>
            )}

            {differsFromGlobal ? (
              <p className="text-xs font-medium text-foreground" role="status">
                Effective chapter setting differs from global.
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <ActionForm
                action={upsertModuleAction}
                submitLabel="Override active"
                className="inline-flex flex-col"
              >
                <input type="hidden" name="moduleKey" value={module.moduleKey} />
                <input type="hidden" name="isActive" value="true" />
                <input type="hidden" name="scope" value="chapter" />
                <input type="hidden" name="chapterId" value={chapterId} />
              </ActionForm>
              <ActionForm
                action={upsertModuleAction}
                submitLabel="Override inactive"
                className="inline-flex flex-col"
              >
                <input type="hidden" name="moduleKey" value={module.moduleKey} />
                <input type="hidden" name="isActive" value="false" />
                <input type="hidden" name="scope" value="chapter" />
                <input type="hidden" name="chapterId" value={chapterId} />
              </ActionForm>
            </div>
          </div>
        );
      })}
    </div>
  );
}
