"use client";

import { ActionForm } from "@/components/forms/action-form";
import { reopenReviewAction } from "@/app/actions/domain";
import { WEEKLY_ANSWER_FIELDS, type WeeklyAnswers } from "@/modules/reviews/schemas";

type ReviewCompletedPanelProps = {
  reviewId: string;
  answers: WeeklyAnswers;
  completedAt: string | null;
  periodStart: string;
  periodEnd: string;
};

export function ReviewCompletedPanel({
  reviewId,
  answers,
  completedAt,
  periodStart,
  periodEnd,
}: ReviewCompletedPanelProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Completed week {periodStart} → {periodEnd}
        {completedAt ? ` · sealed ${completedAt}` : ""}. Read-only until reopened.
      </p>
      <dl className="space-y-4">
        {WEEKLY_ANSWER_FIELDS.map((field) => (
          <div key={field.key}>
            <dt className="text-sm font-medium text-foreground">{field.label}</dt>
            <dd className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
              {answers[field.key]?.trim() ? answers[field.key] : "—"}
            </dd>
          </div>
        ))}
      </dl>
      <ActionForm action={reopenReviewAction} submitLabel="Reopen as draft">
        <input type="hidden" name="id" value={reviewId} />
      </ActionForm>
    </div>
  );
}
