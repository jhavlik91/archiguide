"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Star, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { ReportButton } from "@/features/moderation/components/report-button";
import { PRICING_MODEL_LABELS } from "@/features/profiles/types";
import { acceptResponseAction, shortlistResponseAction } from "../actions";
import { ownerResponseActions, type ResponseAction } from "../state-machine";
import {
  RESPONSE_STATUS_LABELS,
  type ResponseListItemForOwner,
  type ResponseStatus,
} from "../types";
import { RejectResponseDialog } from "./reject-response-dialog";

/**
 * Seznam reakcí na poptávce pro VLASTNÍKA (T027 § Main flow bod 5). Karta:
 * autor, zpráva, cena, přiložené portfolio, akce shortlist/přijmout/odmítnout
 * dle stavového automatu (`ownerResponseActions`).
 */
export function ResponseList({
  responses,
}: {
  responses: ResponseListItemForOwner[];
}) {
  if (responses.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground p-5 text-sm sm:p-6">
          Zatím žádné reakce.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">
        Reakce ({responses.length})
      </p>
      {responses.map((response) => (
        <ResponseCard key={response.id} response={response} />
      ))}
    </div>
  );
}

function statusVariant(
  status: ResponseStatus,
): "default" | "secondary" | "outline" | "destructive" {
  if (status === "shortlisted") return "default";
  if (status === "accepted") return "secondary";
  if (status === "rejected" || status === "withdrawn") return "destructive";
  return "outline";
}

const ACTION_LABELS: Record<ResponseAction, string> = {
  send: "Odeslat",
  mark_viewed: "Zobrazit",
  shortlist: "Na užší seznam",
  accept: "Přijmout",
  reject: "Odmítnout",
  withdraw: "Stáhnout",
};

function ResponseCard({ response }: { response: ResponseListItemForOwner }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rejectOpen, setRejectOpen] = useState(false);
  const actions = ownerResponseActions(response.status);

  function run(action: "shortlist" | "accept") {
    startTransition(async () => {
      const res =
        action === "shortlist"
          ? await shortlistResponseAction(response.id)
          : await acceptResponseAction(response.id);
      if (res.ok) {
        toast.success(`Reakce: ${ACTION_LABELS[action].toLowerCase()}.`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium">{response.authorSummary.displayName}</p>
          <Badge variant={statusVariant(response.status)}>
            {RESPONSE_STATUS_LABELS[response.status]}
          </Badge>
        </div>

        <p className="text-sm whitespace-pre-wrap">{response.message}</p>

        <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {response.priceModel ? (
            <span>{PRICING_MODEL_LABELS[response.priceModel]}</span>
          ) : null}
          {response.priceNote ? <span>{response.priceNote}</span> : null}
          {response.availability ? <span>{response.availability}</span> : null}
        </div>

        {response.portfolioItems.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {response.portfolioItems.map((item) =>
              item.slug ? (
                <a
                  key={item.id}
                  href={`/projekt/${item.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary text-sm hover:underline"
                >
                  {item.title}
                </a>
              ) : (
                <span key={item.id} className="text-muted-foreground text-sm">
                  {item.title}
                </span>
              ),
            )}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {actions.includes("shortlist") ? (
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => run("shortlist")}
            >
              {pending ? <Loader2 className="animate-spin" /> : <Star />}
              {ACTION_LABELS.shortlist}
            </Button>
          ) : null}
          {actions.includes("accept") ? (
            <Button size="sm" disabled={pending} onClick={() => run("accept")}>
              {pending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
              {ACTION_LABELS.accept}
            </Button>
          ) : null}
          {actions.includes("reject") ? (
            <Button
              variant="destructive"
              size="sm"
              disabled={pending}
              onClick={() => setRejectOpen(true)}
            >
              <X />
              {ACTION_LABELS.reject}
            </Button>
          ) : null}
          <ReportButton
            targetType="request_response"
            targetId={response.id}
            label="Nahlásit"
            variant="ghost"
            size="sm"
          />
        </div>
      </CardContent>

      <RejectResponseDialog
        responseId={response.id}
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        onDone={() => router.refresh()}
      />
    </Card>
  );
}
