"use client";

import { useState, useTransition } from "react";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import {
  MESSAGE_REPORT_REASONS,
  REPORT_NOTE_MAX_LENGTH,
  REPORT_REASON_LABELS,
  type ReportReason,
} from "@/features/moderation/types";
import { reportMessage } from "../actions";

/**
 * Dialog nahlášení zprávy (T031 § Main flow bod 3). Vybere se důvod z enumu
 * (povinné) a volitelný popis; odešle se přes `reportMessage`. Moderátorovi se
 * zpřístupní jen nahlášená zpráva + kontext (T036), ne celá historie.
 */
export function ReportMessageDialog({ messageId }: { messageId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit() {
    if (!reason || isPending) return;
    startTransition(async () => {
      const res = await reportMessage({ messageId, reason, note });
      if (res.ok) {
        toast.success("Zpráva byla nahlášena. Díky, podíváme se na to.");
        setOpen(false);
        setReason(null);
        setNote("");
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Nahlásit zprávu"
          className="text-muted-foreground hover:text-foreground mb-1 opacity-0 transition-opacity group-hover:opacity-100"
        >
          <Flag className="size-4" />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nahlásit zprávu</DialogTitle>
          <DialogDescription>
            Vyberte důvod. Moderátorovi zpřístupníme jen tuto zprávu a nezbytný
            kontext, ne celou konverzaci.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={reason ?? ""}
          onValueChange={(v) => setReason(v as ReportReason)}
          className="gap-2"
        >
          {MESSAGE_REPORT_REASONS.map((r) => (
            <div key={r} className="flex items-center gap-2">
              <RadioGroupItem value={r} id={`report-reason-${r}`} />
              <Label htmlFor={`report-reason-${r}`} className="font-normal">
                {REPORT_REASON_LABELS[r]}
              </Label>
            </div>
          ))}
        </RadioGroup>

        <div className="space-y-1.5">
          <Label htmlFor="report-note" className="text-muted-foreground text-xs">
            Popis (nepovinné)
          </Label>
          <Textarea
            id="report-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={REPORT_NOTE_MAX_LENGTH}
            rows={3}
            placeholder="Doplňující informace pro moderátora…"
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Zrušit
          </Button>
          <Button onClick={submit} disabled={!reason || isPending}>
            Nahlásit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
