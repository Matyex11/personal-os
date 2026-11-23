import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { Input } from "@/components/ui/input";
import {
  activateChapterAction,
  closeChapterAction,
  makeChapterCurrentAction,
} from "@/app/actions/domain";
import type { ChapterRow } from "@/lib/db/types";

type ChapterCardActionsProps = {
  chapter: ChapterRow;
  today: string;
};

export function ChapterCardActions({ chapter, today }: ChapterCardActionsProps) {
  if (chapter.status === "closed") {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        Historical — closed chapters cannot be reactivated or made current.
      </p>
    );
  }

  if (chapter.status === "planned") {
    return (
      <ActionForm action={activateChapterAction} submitLabel="Activate">
        <input type="hidden" name="chapterId" value={chapter.id} />
      </ActionForm>
    );
  }

  // active
  return (
    <div className="space-y-3">
      {!chapter.is_current ? (
        <ActionForm action={makeChapterCurrentAction} submitLabel="Make current">
          <input type="hidden" name="chapterId" value={chapter.id} />
        </ActionForm>
      ) : (
        <p className="text-sm text-muted-foreground" role="status">
          This is the current chapter.
        </p>
      )}
      <ActionForm action={closeChapterAction} submitLabel="Close chapter">
        <input type="hidden" name="chapterId" value={chapter.id} />
        <Field id={`ended-${chapter.id}`} label="Ended on">
          <Input
            id={`ended-${chapter.id}`}
            name="endedOn"
            type="date"
            defaultValue={today}
            min={chapter.started_on}
            required
          />
        </Field>
      </ActionForm>
    </div>
  );
}
