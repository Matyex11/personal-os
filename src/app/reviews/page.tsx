import { PageHeader } from "@/components/layout/page-header";
import { DisabledModuleState } from "@/components/modules/disabled-module-state";
import { ReviewCompletedPanel } from "@/components/reviews/review-completed-panel";
import { ReviewDraftForm } from "@/components/reviews/review-draft-form";
import { ReviewHistory } from "@/components/reviews/review-history";
import { ReviewSummaryPanel } from "@/components/reviews/review-summary-panel";
import { EmptyState } from "@/components/states/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionModuleGating } from "@/modules/modules/gating";
import {
  getOrCreateWeeklyReview,
  getWeeklyReviewSummary,
  listReviews,
} from "@/modules/reviews/service";

export const metadata = {
  title: "Reviews",
};

export default async function ReviewsPage() {
  const gating = await getSessionModuleGating();

  if (gating.status === "ok" && !gating.reviewsActive) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Reviews"
          description="Weekly reflections for the current ISO week in your profile timezone."
        />
        <DisabledModuleState
          title="Reviews module is inactive"
          description="Reviews are turned off for the current chapter (or globally when no chapter is current). Activate the reviews module from Chapters to draft and complete weekly reviews. Existing reviews are kept — activation only controls availability."
        />
      </div>
    );
  }

  const current = await getOrCreateWeeklyReview({});
  const list = await listReviews({ limit: 52 });
  const summary =
    current.ok
      ? await getWeeklyReviewSummary(current.data.periodStart, current.data.periodEnd)
      : null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Reviews"
        description="One weekly review per ISO week (Monday–Sunday). Drafts are editable; completed weeks are read-only until reopened. Summaries are computed on display."
      />

      {!current.ok ? (
        <EmptyState title="Weekly review unavailable" description={current.message} />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>
                This week · {current.data.periodStart} → {current.data.periodEnd}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {summary?.ok ? (
                <ReviewSummaryPanel summary={summary.data} />
              ) : summary && !summary.ok ? (
                <EmptyState title="Summary unavailable" description={summary.message} />
              ) : null}

              {current.data.review.status === "draft" ? (
                <ReviewDraftForm
                  key={current.data.review.id}
                  reviewId={current.data.review.id}
                  answers={current.data.review.answers}
                />
              ) : (
                <ReviewCompletedPanel
                  reviewId={current.data.review.id}
                  answers={current.data.review.answers}
                  completedAt={current.data.review.completedAt}
                  periodStart={current.data.periodStart}
                  periodEnd={current.data.periodEnd}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>History</CardTitle>
            </CardHeader>
            <CardContent>
              {!list.ok ? (
                <EmptyState title="History unavailable" description={list.message} />
              ) : (
                <ReviewHistory
                  rows={list.data}
                  currentPeriodStart={current.data.periodStart}
                />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
