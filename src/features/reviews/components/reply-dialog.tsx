"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Reply } from "lucide-react";
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
import { replyToReviewAction } from "../actions";
import { REVIEW_REPLY_MAX_LENGTH } from "../types";

/** Právo na reakci hodnoceného (§36.3, main flow bod 5) — jedna veřejná odpověď. */
export function ReplyToReviewButton({ reviewId }: { reviewId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = await replyToReviewAction(reviewId, { text });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Odpověď byla zveřejněna.");
      setOpen(false);
      setText("");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Reply className="size-4" />
        Odpovědět
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Odpovědět na hodnocení</DialogTitle>
          <DialogDescription>
            Odpověď je veřejná a lze ji přidat jen jednou.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="review-reply">Vaše odpověď</Label>
          <Textarea
            id="review-reply"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={REVIEW_REPLY_MAX_LENGTH}
            rows={4}
            placeholder="Reagujte věcně na hodnocení…"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Zrušit
          </Button>
          <Button onClick={submit} disabled={pending || text.trim().length === 0}>
            {pending ? <Loader2 className="animate-spin" /> : <Reply />}
            Odeslat odpověď
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
