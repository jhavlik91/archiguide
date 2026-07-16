"use client";

import { useState, useTransition } from "react";
import { Flag, Loader2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { reportContentAction } from "../actions";
import {
  GENERIC_REPORT_REASONS,
  REPORT_REASON_LABELS,
  type ReportReason,
  type ReportTargetType,
} from "../types";

/**
 * Sdílená komponenta „Nahlásit" (T036 § Main flow bod 2). Konzumující domény
 * (T008 profil, T016 portfolio, T026 poptávka, T031 zpráva, T037 recenze) ji
 * jen embedují s cílovým typem a ID — validaci, oprávnění i stavovou logiku
 * řeší tenhle modul.
 */
export function ReportButton({
  targetType,
  targetId,
  label = "Nahlásit",
  variant = "ghost",
  size = "sm",
}: {
  targetType: ReportTargetType;
  targetId: string;
  label?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | "">("");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!reason) {
      toast.error("Vyberte důvod nahlášení.");
      return;
    }
    startTransition(async () => {
      const result = await reportContentAction({
        targetType,
        targetId,
        reason,
        note,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.deduped
          ? "Toto jsme už zaznamenali — děkujeme za upozornění."
          : "Nahlášení bylo odesláno moderátorům.",
      );
      setOpen(false);
      setReason("");
      setNote("");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={() => setOpen(true)}
        aria-label="Nahlásit obsah"
      >
        <Flag className="size-4" />
        {label}
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nahlásit obsah</DialogTitle>
          <DialogDescription>
            Nahlášení posoudí moderátor. O výsledku vás informujeme, detaily
            případného zásahu ale nesdělujeme.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="report-reason">Důvod</Label>
            <Select
              value={reason}
              onValueChange={(v) => setReason(v as ReportReason)}
            >
              <SelectTrigger id="report-reason">
                <SelectValue placeholder="Vyberte důvod" />
              </SelectTrigger>
              <SelectContent>
                {GENERIC_REPORT_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {REPORT_REASON_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="report-note">Poznámka (nepovinné)</Label>
            <Textarea
              id="report-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Doplňující kontext pro moderátora…"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Zrušit
          </Button>
          <Button onClick={submit} disabled={pending || !reason}>
            {pending ? <Loader2 className="animate-spin" /> : <Flag />}
            Odeslat nahlášení
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
