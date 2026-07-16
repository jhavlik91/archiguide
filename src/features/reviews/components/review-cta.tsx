"use client";

import { useState } from "react";
import { CheckCircle2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReviewFormDialog } from "./review-form-dialog";
import type { ReviewRatings } from "../types";

export interface ReviewCtaState {
  id: string;
  ratings: ReviewRatings;
  text: string | null;
  /** V 24h okně od odeslání (main flow bod 3)? Mimo okno je recenze zamčená. */
  editable: boolean;
}

/**
 * Nabídka k ohodnocení na detailu poptávky (T037 § Main flow bod 2) — vedle
 * accepted reakce. Bez recenze nabídne založení; existující v 24h okně
 * nabídne úpravu; mimo okno jen potvrdí odeslání.
 */
export function ReviewCallToAction({
  evidenceResponseId,
  targetName,
  review,
}: {
  evidenceResponseId: string;
  targetName: string;
  review: ReviewCtaState | null;
}) {
  const [open, setOpen] = useState(false);

  if (review && !review.editable) {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
        <CheckCircle2 className="size-4" />
        Hodnocení odesláno
      </span>
    );
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Star className="size-4" />
        {review ? "Upravit hodnocení" : "Ohodnotit spolupráci"}
      </Button>
      <ReviewFormDialog
        open={open}
        onOpenChange={setOpen}
        evidenceResponseId={review ? undefined : evidenceResponseId}
        reviewId={review?.id}
        initial={review ? { ratings: review.ratings, text: review.text } : undefined}
        targetName={targetName}
      />
    </>
  );
}
