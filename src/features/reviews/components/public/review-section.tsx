import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ReportButton } from "@/features/moderation/components/report-button";
import {
  REVIEW_BADGE_TEXT,
  REVIEW_CRITERIA,
  REVIEW_CRITERION_LABELS,
  type ReviewAggregate,
  type ReviewView,
} from "../../types";
import { DisputeReviewButton } from "../dispute-dialog";
import { ReplyToReviewButton } from "../reply-dialog";
import { StarRatingDisplay } from "../star-rating";

/**
 * Veřejná sekce hodnocení pro profil profesionála (T008) / firmy (T010).
 * Prázdný seznam se nevykreslí (stejná konvence jako portfolio sekce —
 * „dokud nemají data, sekce se nezobrazují"). Reply/dispute se nabídne jen
 * `isOwner` (majitel/editor cíle recenze).
 */
export function ReviewSection({
  aggregate,
  reviews,
  isOwner,
}: {
  aggregate: ReviewAggregate;
  reviews: ReviewView[];
  isOwner: boolean;
}) {
  if (reviews.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          {aggregate.overallAverage !== null ? (
            <div className="flex items-center gap-2">
              <StarRatingDisplay value={aggregate.overallAverage} size="md" />
              <span className="text-sm font-medium">{aggregate.overallAverage}/5</span>
            </div>
          ) : null}
          <span className="text-muted-foreground text-sm">
            {aggregate.count} hodnocení
          </span>
        </div>
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <ShieldCheck className="size-3.5" aria-hidden />
          {REVIEW_BADGE_TEXT}
        </p>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
          {REVIEW_CRITERIA.map((criterion) => {
            const value = aggregate.criteriaAverages[criterion];
            if (value === null) return null;
            return (
              <div key={criterion} className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">
                  {REVIEW_CRITERION_LABELS[criterion]}
                </dt>
                <dd className="font-medium">{value}</dd>
              </div>
            );
          })}
        </dl>
      </div>

      <ul className="space-y-3">
        {reviews.map((review) => (
          <ReviewCard key={review.id} review={review} isOwner={isOwner} />
        ))}
      </ul>
    </div>
  );
}

function ReviewCard({ review, isOwner }: { review: ReviewView; isOwner: boolean }) {
  return (
    <li className="border-border space-y-2 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">{review.reviewerDisplayName}</span>
        <div className="flex items-center gap-2">
          {review.status === "disputed" ? (
            <Badge variant="warning">Rozporováno</Badge>
          ) : null}
          <time className="text-muted-foreground text-xs" dateTime={review.createdAt}>
            {new Date(review.createdAt).toLocaleDateString("cs-CZ")}
          </time>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
        {REVIEW_CRITERIA.map((criterion) => (
          <div key={criterion} className="flex items-center gap-1.5">
            <span className="text-muted-foreground text-xs">
              {REVIEW_CRITERION_LABELS[criterion]}
            </span>
            <StarRatingDisplay value={review.ratings[criterion]} />
          </div>
        ))}
      </div>

      {review.text ? (
        <p className="text-sm whitespace-pre-wrap">{review.text}</p>
      ) : null}

      {review.replyText ? (
        <div className="bg-muted/50 space-y-0.5 rounded-md p-3 text-sm">
          <p className="text-muted-foreground text-xs font-medium">
            Odpověď hodnoceného
          </p>
          <p className="whitespace-pre-wrap">{review.replyText}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-1">
        {isOwner && !review.replyText ? <ReplyToReviewButton reviewId={review.id} /> : null}
        {isOwner && review.status === "published" ? (
          <DisputeReviewButton reviewId={review.id} />
        ) : null}
        <ReportButton
          targetType="review"
          targetId={review.id}
          label="Nahlásit"
          variant="ghost"
          size="sm"
        />
      </div>
    </li>
  );
}
