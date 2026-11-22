import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  closeChapterAction,
  createChapterAction,
  upsertModuleAction,
} from "@/app/actions/domain";
import { listChapters } from "@/modules/chapters/service";
import { listModuleActivations } from "@/modules/modules/service";

export const metadata = {
  title: "Chapters",
};

export default async function ChaptersPage() {
  const chapters = await listChapters();
  const modules = await listModuleActivations();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Chapters"
        description="Named life periods with explicit lifecycle. Module activations resolve chapter override → global → off."
      />

      {!chapters.ok ? (
        <EmptyState
          title="Chapters unavailable"
          description={chapters.message}
        />
      ) : chapters.data.length === 0 ? (
        <EmptyState
          title="No chapters yet"
          description="Create an active chapter to frame habits and projects. Tables must exist on DEV after L3 migration apply."
        />
      ) : (
        <div className="grid gap-3">
          {chapters.data.map((chapter) => (
            <Card key={chapter.id}>
              <CardHeader>
                <CardTitle>
                  {chapter.title}
                  {chapter.is_current ? " · current" : ""}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  {chapter.status} · {chapter.started_on}
                  {chapter.ended_on ? ` → ${chapter.ended_on}` : ""}
                </p>
                {chapter.status !== "closed" ? (
                  <ActionForm action={closeChapterAction} submitLabel="Close chapter">
                    <input type="hidden" name="chapterId" value={chapter.id} />
                    <Field id={`ended-${chapter.id}`} label="Ended on">
                      <Input id={`ended-${chapter.id}`} name="endedOn" type="date" defaultValue={today} required />
                    </Field>
                  </ActionForm>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>New chapter</CardTitle>
        </CardHeader>
        <CardContent>
          <ActionForm action={createChapterAction} submitLabel="Create chapter" className="grid gap-3 sm:grid-cols-2">
            <Field id="title" label="Title">
              <Input id="title" name="title" required />
            </Field>
            <Field id="startedOn" label="Started on">
              <Input id="startedOn" name="startedOn" type="date" defaultValue={today} required />
            </Field>
            <Field id="status" label="Status">
              <select
                id="status"
                name="status"
                defaultValue="active"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="planned">planned</option>
                <option value="active">active</option>
              </select>
            </Field>
            <label className="flex items-center gap-2 self-end text-sm">
              <input type="checkbox" name="isCurrent" defaultChecked />
              Mark current
            </label>
          </ActionForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Global modules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!modules.ok ? (
            <p className="text-sm text-destructive">{modules.message}</p>
          ) : (
            modules.data.map((module) => (
              <div key={module.moduleKey} className="flex items-center justify-between gap-3 text-sm">
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
                  <input type="hidden" name="isActive" value={module.isActive ? "false" : "true"} />
                </ActionForm>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
