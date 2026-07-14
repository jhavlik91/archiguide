"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  Link2,
  Link2Off,
  Loader2,
  Send,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { revokeShareAction, shareBriefAction } from "../actions";
import { sharedBriefPath } from "../paths";
import { PRIVACY_WARNING_LABELS, type PrivacyWarningKind } from "../privacy";
import type { BriefView } from "../types";

/**
 * Panel sdílení briefu (T022 § Main flow 3–4). Vygeneruje/odvolá privátní odkaz,
 * ukáže ho ke zkopírování a řeší:
 *  - PRIVACY varování (zadani/12 §8): obsahuje-li text přesnou adresu/telefon/
 *    e-mail, zobrazí explicitní upozornění a nechá uživatele vědomě potvrdit
 *    (NEblokuje),
 *  - REVISED stav: po úpravě po sdílení upozorní, že sdílená verze je starší, a
 *    nabídne sdílet aktuální verzi.
 *
 * Sdílet/odvolat smí jen vlastník — panel se renderuje jen v jeho náhledu.
 */
export function BriefSharePanel({ brief }: { brief: BriefView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [warnings, setWarnings] = useState<PrivacyWarningKind[] | null>(null);

  const isShared = brief.shareToken !== null;
  const shareUrl = useMemo(() => {
    if (!brief.shareToken) return null;
    const path = sharedBriefPath(brief.shareToken);
    if (typeof window === "undefined") return path;
    return `${window.location.origin}${path}`;
  }, [brief.shareToken]);

  function share(confirmed: boolean) {
    startTransition(async () => {
      const res = await shareBriefAction(brief.id, confirmed);
      if (res.ok) {
        setWarnings(null);
        toast.success(
          res.reshared
            ? "Sdílená verze byla aktualizována."
            : "Odkaz vytvořen.",
        );
        router.refresh();
        return;
      }
      if ("needsConfirmation" in res) {
        setWarnings(res.warnings);
        return;
      }
      toast.error(res.error);
    });
  }

  function revoke() {
    startTransition(async () => {
      const res = await revokeShareAction(brief.id);
      if (res.ok) {
        toast.success("Odkaz byl odvolán.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  async function copy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Odkaz se nepodařilo zkopírovat.");
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-5 sm:p-6">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Link2 className="size-4" />
            Sdílení odkazem
          </h2>
          <p className="text-muted-foreground text-sm">
            Kdokoli s odkazem uvidí brief jen ke čtení (bez přihlášení). Přesná
            adresa ani soukromé přílohy se nesdílejí.
          </p>
        </div>

        {/* Upozornění, že sdílená verze je starší než aktuální úpravy (revised). */}
        {isShared && brief.hasUnsharedChanges ? (
          <div className="border-warning/40 bg-warning/10 text-foreground flex gap-2 rounded-md border p-3 text-sm">
            <TriangleAlert className="text-warning mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-medium">
                Sdílená verze je starší než vaše úpravy.
              </p>
              <p className="text-muted-foreground">
                Příjemci zatím vidí verzi z předchozího sdílení. Chcete sdílet
                aktuální podobu?
              </p>
            </div>
          </div>
        ) : null}

        {isShared && shareUrl ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                readOnly
                value={shareUrl}
                aria-label="Sdílený odkaz"
                className="min-w-0 flex-1 font-mono text-xs"
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button type="button" variant="outline" onClick={copy}>
                {copied ? <Check /> : <Copy />}
                {copied ? "Zkopírováno" : "Kopírovat"}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {brief.hasUnsharedChanges ? (
                <Button onClick={() => share(false)} disabled={pending}>
                  {pending ? <Loader2 className="animate-spin" /> : <Send />}
                  Sdílet aktuální verzi
                </Button>
              ) : null}
              <Button
                variant="outline"
                onClick={revoke}
                disabled={pending}
                className="text-destructive"
              >
                <Link2Off />
                Odvolat odkaz
              </Button>
            </div>
          </div>
        ) : (
          <Button onClick={() => share(false)} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Link2 />}
            Sdílet odkazem
          </Button>
        )}
      </CardContent>

      {/* Privacy varování před sdílením (zadani/12 §8) — neblokuje, jen potvrzení. */}
      <Dialog
        open={warnings !== null}
        onOpenChange={(open) => {
          if (!open) setWarnings(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="text-warning size-5" />
              Text možná obsahuje osobní údaje
            </DialogTitle>
            <DialogDescription>
              Ve sdíleném textu jsme našli vzor, který vypadá jako{" "}
              {warnings ? formatWarnings(warnings) : ""}. Kdokoli s odkazem to
              uvidí. Zkontrolujte prosím obsah — sdílet můžete i tak.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setWarnings(null)}>
              Zpět k úpravám
            </Button>
            <Button onClick={() => share(true)} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              Sdílet přesto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/** Lidsky spojí seznam varování: „přesná adresa a telefonní číslo". */
function formatWarnings(kinds: PrivacyWarningKind[]): string {
  const labels = kinds.map((k) => PRIVACY_WARNING_LABELS[k]);
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(", ")} a ${labels[labels.length - 1]}`;
}
