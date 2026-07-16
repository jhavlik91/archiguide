"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
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
import { disputeReviewAction } from "../actions";
import { REVIEW_DISPUTE_REASON_MAX_LENGTH } from "../types";

/** Formální spor hodnoceného nad recenzí (T037 § Main flow bod 6). */
export function DisputeReviewButton({ reviewId }: { reviewId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = await disputeReviewAction(reviewId, { reason });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Spor byl podán — případ posoudí moderátor.");
      setOpen(false);
      setReason("");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <AlertTriangle className="size-4" />
        Rozporovat
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rozporovat hodnocení</DialogTitle>
          <DialogDescription>
            Recenze zůstane veřejná s příznakem „rozporováno“, dokud případ
            neposoudí moderátor. Uveďte prosím konkrétní důvod.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="review-dispute-reason">Důvod sporu</Label>
          <Textarea
            id="review-dispute-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={REVIEW_DISPUTE_REASON_MAX_LENGTH}
            rows={4}
            placeholder="Např. „Hodnocení neodpovídá průběhu zakázky, protože…“"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Zrušit
          </Button>
          <Button
            variant="destructive"
            onClick={submit}
            disabled={pending || reason.trim().length < 5}
          >
            {pending ? <Loader2 className="animate-spin" /> : <AlertTriangle />}
            Podat spor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
