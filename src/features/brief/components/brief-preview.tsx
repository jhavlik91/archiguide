"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  CheckCircle2,
  Download,
  FileText,
  Link2,
  Loader2,
  Lock,
  Pencil,
  Send,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import {
  archiveBriefAction,
  markBriefReadyAction,
  regenerateBriefAction,
} from "../actions";
import { createRequestFromBriefAction } from "@/features/requests/actions";
import {
  BRIEF_STATUS_LABELS,
  BRIEF_VISIBILITY_LABELS,
  type BriefView,
} from "../types";
import { BriefContentView } from "./brief-content-view";
import { BriefSharePanel } from "./brief-share-panel";

/**
 * Náhled briefu — vlastnický „domeček" (T021 + T022). Zobrazí obsah §18
 * (read-only přes `BriefContentView`) a nabídne akce: uložit (draft → ready),
 * upravit (editor), sdílet odkazem (panel), exportovat, archivovat, přegenerovat.
 * Archivovaný brief je jen ke čtení (akce skryté).
 */
export function BriefPreview({ brief }: { brief: BriefView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmArchive, setConfirmArchive] = useState(false);
  const isDraft = brief.status === "draft";
  const isArchived = brief.status === "archived";
  const isPrivate = brief.visibility === "private";

  function saveBrief() {
    startTransition(async () => {
      const res = await markBriefReadyAction(brief.id);
      if (res.ok) {
        toast.success("Brief uložen.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function createRequest() {
    // Akce založí draft poptávku a přesměruje na její detail (redirect uvnitř).
    startTransition(async () => {
      await createRequestFromBriefAction(brief.id);
    });
  }

  function regenerate() {
    startTransition(async () => {
      const res = await regenerateBriefAction(brief.id);
      if (res.ok) {
        toast.success("Brief přegenerován z odpovědí.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function archive() {
    startTransition(async () => {
      const res = await archiveBriefAction(brief.id);
      setConfirmArchive(false);
      if (res.ok) {
        toast.success("Brief archivován.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Hlavička: stav + viditelnost + název. */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={isDraft ? "secondary" : "default"}>
            {BRIEF_STATUS_LABELS[brief.status]}
          </Badge>
          <Badge variant="outline">
            {isPrivate ? (
              <Lock className="mr-1 size-3" />
            ) : (
              <Link2 className="mr-1 size-3" />
            )}
            {BRIEF_VISIBILITY_LABELS[brief.visibility]}
          </Badge>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{brief.title}</h1>
      </div>

      {isArchived ? (
        <div className="bg-muted/50 text-muted-foreground flex items-center gap-2 rounded-md border p-3 text-sm">
          <Archive className="size-4 shrink-0" />
          Tento brief je archivovaný — zůstává jen ke čtení.
        </div>
      ) : null}

      {/* Obsah §18 (read-only). */}
      <BriefContentView content={brief.content} />

      {/* Sdílení odkazem (T022). Archivovaný brief se nesdílí. */}
      {!isArchived ? <BriefSharePanel brief={brief} /> : null}

      {/* Akce. */}
      <Card>
        <CardContent className="space-y-3 p-5 sm:p-6">
          <div className="flex flex-wrap gap-2">
            {!isArchived && isDraft ? (
              <Button onClick={saveBrief} disabled={pending}>
                {pending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <CheckCircle2 />
                )}
                Uložit brief
              </Button>
            ) : null}

            {!isArchived ? (
              <Button asChild variant="outline">
                <Link href={`/brief/${brief.id}/upravit`}>
                  <Pencil />
                  Upravit brief
                </Link>
              </Button>
            ) : null}

            <Button asChild variant="outline">
              <Link href={`/brief/${brief.id}/export`}>
                <Download />
                Export
              </Link>
            </Button>

            {/* Vytvoření poptávky z briefu (T024). Archivovaný brief je jen ke
                čtení, takže z něj poptávku nezakládáme (stejně jako ostatní akce). */}
            {!isArchived ? (
              <Button variant="outline" onClick={createRequest} disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : <Send />}
                Vytvořit poptávku
              </Button>
            ) : null}

            {!isArchived && brief.guideSessionId ? (
              <Button variant="ghost" onClick={regenerate} disabled={pending}>
                <FileText />
                Přegenerovat z odpovědí
              </Button>
            ) : null}

            {isDraft ? (
              <Button
                variant="ghost"
                onClick={() => setConfirmArchive(true)}
                disabled={pending}
                className="text-muted-foreground"
              >
                <Archive />
                Archivovat
              </Button>
            ) : null}
          </div>

          <p className="text-muted-foreground text-sm">
            Brief je uložený ve vašem účtu — můžete se k němu kdykoli vrátit.{" "}
            <Link
              href="/dashboard"
              className="text-primary font-medium hover:underline"
            >
              Zpět na přehled
            </Link>
          </p>
        </CardContent>
      </Card>

      <Dialog open={confirmArchive} onOpenChange={setConfirmArchive}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archivovat brief?</DialogTitle>
            <DialogDescription>
              Archivovaný brief zmizí z aktivního přehledu a zůstane jen ke
              čtení. Tuto akci lze provést jen u rozpracovaného briefu.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmArchive(false)}>
              Zrušit
            </Button>
            <Button onClick={archive} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Archive />}
              Archivovat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
