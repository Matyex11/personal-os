import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { ActionForm } from "@/components/forms/action-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChapterCardActions } from "@/components/chapters/chapter-card-actions";
import { ChapterCreateForm } from "@/components/chapters/chapter-create-form";
import { ChapterModuleOverrides } from "@/components/chapters/chapter-module-overrides";
import { upsertModuleAction } from "@/app/actions/domain";
import { todayInTimeZone } from "@/lib/dates/calendar";
import { listChapters } from "@/modules/chapters/service";
import { getProfileTimeZone } from "@/modules/habits/service";
import { resolveModuleActivations } from "@/modules/modules/resolve";
import { listModuleActivations } from "@/modules/modules/service";

export const metadata = {
  title: "Chapters",
};

export default async function ChaptersPage() {
  const chapters = await listChapters();
  const currentChapter =
    chapters.ok ? chapters.data.find((chapter) => chapter.is_current) : undefined;
  const modules = await listModuleActivations(currentChapter?.id);
  const globalModules = modules.ok ? resolveModuleActivations(modules.rows) : null;
  const chapterModules = modules.ok ? modules.data : null;
  const timeZone = await getProfileTimeZone();
  const today = todayInTimeZone(timeZone);

  const hasCurrent =
    chapters.ok && chapters.data.some((chapter) => chapter.is_current);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Chapters"
        description="Named life periods: planned → active → closed. One current active chapter at a time."
      />

      {!chapters.ok ? (
        <EmptyState title="Chapters unavailable" description={chapters.message} />
      ) : chapters.data.length === 0 ? (
        <EmptyState
          title="No chapters yet"
          description="Create a planned or active chapter to frame habits and projects."
        />
      ) : (
        <div className="space-y-4">
          {!hasCurrent ? (
            <EmptyState
              title="No current chapter"
              description="There is no current chapter right now. Activate a planned chapter if needed, then use Make current on an active chapter. Closing the current chapter leaves none selected automatically."
            />
          ) : null}

          <div className="grid gap-3">
            {chapters.data.map((chapter) => (
              <Card key={chapter.id}>
                <CardHeader>
                  <CardTitle>
                    {chapter.title}
                    {chapter.is_current ? " · current" : ""}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">{chapter.status}</span>
                    {" · "}
                    {chapter.started_on}
                    {chapter.ended_on ? ` → ${chapter.ended_on}` : ""}
                    {chapter.is_current ? " · current" : ""}
                  </p>
                  {chapter.summary ? (
                    <p className="text-muted-foreground">{chapter.summary}</p>
                  ) : null}
                  <ChapterCardActions chapter={chapter} today={today} />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>New chapter</CardTitle>
        </CardHeader>
        <CardContent>
          <ChapterCreateForm today={today} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Global modules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!modules.ok || !globalModules ? (
            <p className="text-sm text-destructive">
              {modules.ok ? "Could not load modules." : modules.message}
            </p>
          ) : (
            globalModules.map((module) => (
              <div
                key={module.moduleKey}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span>
                  {module.moduleKey}{" "}
                  <span className="text-muted-foreground">
                    ({module.isActive ? "on" : "off"} · {module.source})
                  </span>
                </span>
                <ActionForm
                  action={upsertModuleAction}
                  submitLabel={module.isActive ? "Disable" : "Enable"}
                >
                  <input type="hidden" name="moduleKey" value={module.moduleKey} />
                  <input
                    type="hidden"
                    name="isActive"
                    value={module.isActive ? "false" : "true"}
                  />
                  <input type="hidden" name="scope" value="global" />
                </ActionForm>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current chapter modules</CardTitle>
        </CardHeader>
        <CardContent>
          {!currentChapter ? (
            <EmptyState
              title="No current chapter"
              description="Chapter-specific module overrides require a current chapter. Activate a planned chapter if needed, then use Make current on an active chapter."
            />
          ) : !modules.ok || !chapterModules || !globalModules ? (
            <p className="text-sm text-destructive">
              {modules.ok ? "Could not load modules." : modules.message}
            </p>
          ) : (
            <ChapterModuleOverrides
              chapterId={currentChapter.id}
              chapterTitle={currentChapter.title}
              chapterResolved={chapterModules}
              globalResolved={globalModules}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
