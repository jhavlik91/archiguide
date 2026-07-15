"use client";

import { Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PRIVACY_WARNING_LABELS,
  type PrivacyWarningKind,
} from "@/features/brief/privacy";

/**
 * Sanitizační varování před zpřístupněním textu (T025 § Main flow 4, zadani/05
 * — „publikace identity u anonymizované poptávky" = citlivá akce s explicitním
 * potvrzením). Sdílí ji `RequestVisibilityPanel` (zpřístupňující změna
 * viditelnosti) i upřesnění publikované poptávky (`PublishedView` — úprava
 * pole, které je už veřejně vidět) — obě místa řeší STEJNÝ risk stejným UI.
 * NEblokuje: `onConfirm` provede akci s `confirmed: true`.
 */
export function RequestPrivacyWarningDialog({
  warnings,
  pending,
  onCancel,
  onConfirm,
}: {
  warnings: PrivacyWarningKind[] | null;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={warnings !== null}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="text-warning size-5" />
            Text možná obsahuje osobní údaje
          </DialogTitle>
          <DialogDescription>
            V poptávce (nebo přiloženém briefu) jsme našli vzor, který vypadá
            jako {warnings ? formatWarnings(warnings) : ""}. Kdokoli veřejnou
            poptávku uvidí. Zkontrolujte prosím obsah — pokračovat můžete i tak.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            Zpět k úpravám
          </Button>
          <Button onClick={onConfirm} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            Pokračovat přesto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Lidsky spojí seznam varování: „přesná adresa a telefonní číslo". */
function formatWarnings(kinds: PrivacyWarningKind[]): string {
  const labels = kinds.map((k) => PRIVACY_WARNING_LABELS[k]);
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(", ")} a ${labels[labels.length - 1]}`;
}
