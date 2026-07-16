"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { submitReviewAction, updateReviewAction } from "../actions";
import { REVIEW_CRITERIA, REVIEW_CRITERION_LABELS, type ReviewRatings } from "../types";
import { StarRatingInput } from "./star-rating";

const DEFAULT_RATINGS: ReviewRatings = {
  communication: 0,
  quality: 0,
  timeliness: 0,
  transparency: 0,
  professionalism: 0,
};

/**
 * Formulář hodnocení (T037 § Main flow bod 1). Použije se jak pro založení
 * (nad accepted interakcí), tak pro editaci v 24h okně po odeslání —
 * `reviewId` přítomný přepne dialog do editačního režimu.
 */
export function ReviewFormDialog({
  open,
  onOpenChange,
  evidenceResponseId,
  reviewId,
  initial,
  targetName,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Nová recenze: ID accepted interakce, nad kterou se recenze zakládá. */
  evidenceResponseId?: string;
  /** Editace existující recenze (v 24h okně). */
  reviewId?: string;
  initial?: { ratings: ReviewRatings; text: string | null };
  targetName: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [ratings, setRatings] = useState<ReviewRatings>(
    initial?.ratings ?? DEFAULT_RATINGS,
  );
  const [text, setText] = useState(initial?.text ?? "");
  const [pending, startTransition] = useTransition();

  const isEditing = Boolean(reviewId);
  const allRated = REVIEW_CRITERIA.every((c) => ratings[c] > 0);

  function submit() {
    if (!allRated) {
      toast.error("Ohodnoťte prosím všechna kritéria.");
      return;
    }
    startTransition(async () => {
      const input = { ratings, text };
      const result = isEditing
        ? await updateReviewAction(reviewId!, input)
        : await submitReviewAction(evidenceResponseId!, input);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(isEditing ? "Hodnocení upraveno." : "Hodnocení odesláno.");
      onOpenChange(false);
      onDone?.();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Upravit hodnocení" : "Ohodnotit spolupráci"}
          </DialogTitle>
          <DialogDescription>
            Hodnocení „{targetName}“ na základě ověřené spolupráce.
            {isEditing
              ? " Úprava je možná jen do 24 hodin od odeslání."
              : " Hodnocení bude po odeslání veřejné na profilu."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {REVIEW_CRITERIA.map((criterion) => (
            <StarRatingInput
              key={criterion}
              label={REVIEW_CRITERION_LABELS[criterion]}
              value={ratings[criterion]}
              onChange={(value) => setRatings((prev) => ({ ...prev, [criterion]: value }))}
            />
          ))}
          <div className="space-y-1.5">
            <Label htmlFor="review-text">Komentář (nepovinné)</Label>
            <Textarea
              id="review-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Popište, jak spolupráce probíhala…"
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Zrušit
          </Button>
          <Button onClick={submit} disabled={pending || !allRated}>
            {pending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
            {isEditing ? "Uložit úpravu" : "Odeslat hodnocení"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
