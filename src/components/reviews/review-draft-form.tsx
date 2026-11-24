"use client";

import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import {
  completeReviewAction,
  updateDraftReviewAction,
} from "@/app/actions/domain";
import { WEEKLY_ANSWER_FIELDS, type WeeklyAnswers } from "@/modules/reviews/schemas";

type ReviewDraftFormProps = {
  reviewId: string;
  answers: WeeklyAnswers;
};

export function ReviewDraftForm({ reviewId, answers }: ReviewDraftFormProps) {
  return (
    <div className="space-y-6">
      <ActionForm
        action={updateDraftReviewAction}
        submitLabel="Save draft"
        className="grid gap-4"
      >
        <input type="hidden" name="id" value={reviewId} />
        {WEEKLY_ANSWER_FIELDS.map((field) => (
          <Field key={field.key} id={field.key} label={field.label}>
            <textarea
              id={field.key}
              name={field.key}
              defaultValue={answers[field.key] ?? ""}
              maxLength={2000}
              rows={3}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </Field>
        ))}
      </ActionForm>

      <ActionForm
        action={completeReviewAction}
        submitLabel="Complete week"
        className="flex flex-col gap-2"
      >
        <input type="hidden" name="id" value={reviewId} />
        <p className="text-xs text-muted-foreground">
          Completing seals this week as read-only until you reopen it. Saving a draft does
          not complete the review.
        </p>
      </ActionForm>
    </div>
  );
}
