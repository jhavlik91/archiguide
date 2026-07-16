"use client";

import { useState, useTransition } from "react";
import { Loader2, X } from "lucide-react";
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
import { rejectResponseAction } from "../actions";

/**
 * Odmítnutí reakce s volitelným důvodem (T027 § Main flow bod 6). Autor
 * reakce uvidí důvod, jen pokud ho vlastník vyplní (jinak jen stav
 * `rejected` bez detailu).
 */
export function RejectResponseDialog({
  responseId,
  open,
  onOpenChange,
  onDone,
}: {
  responseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const res = await rejectResponseAction(responseId, { reason });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Reakce odmítnuta.");
      setReason("");
      onOpenChange(false);
      onDone();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Odmítnout reakci</DialogTitle>
          <DialogDescription>
            Důvod je nepovinný. Pokud ho vyplníte, uvidí ho i autor reakce —
            jinak se dozví jen to, že byla odmítnuta.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="reject-reason">Důvod (nepovinné)</Label>
          <Textarea
            id="reject-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Např. „hledáme někoho s bližší zkušeností s rodinnými domy“"
            rows={3}
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Zrušit
          </Button>
          <Button variant="destructive" onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <X />}
            Odmítnout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
