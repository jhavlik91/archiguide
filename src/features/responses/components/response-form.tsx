"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import {
  PRICING_MODELS,
  PRICING_MODEL_LABELS,
  type PricingModel,
} from "@/features/profiles/types";
import {
  submitResponseAction,
  updateResponseAction,
  withdrawResponseAction,
} from "../actions";
import { authorActions } from "../state-machine";
import { RESPONSE_STATUS_LABELS, type ResponseView } from "../types";
import type { PortfolioItemOption } from "../service";

/**
 * Formulář reakce profesionála na poptávku (T027 § Main flow bod 2). Bez
 * existující reakce nabízí založení; existuje-li a je `sent`, stejný formulář
 * slouží k editaci (main flow bod 4); jinak zobrazí jen stav (+ withdraw,
 * pokud ho automat v aktuálním stavu dovolí).
 *
 * Firemní reakce (autor = organizace) zatím tento formulář nenabízí — model i
 * oprávnění to podporují (`ResponseAuthorRef`), UI výběr „reagovat za firmu"
 * je slot pro budoucí práci, stejně jako `shared_link` selektor u poptávky.
 */
export function ResponseForm({
  requestId,
  existing,
  portfolioOptions,
}: {
  requestId: string;
  existing: ResponseView | null;
  portfolioOptions: PortfolioItemOption[];
}) {
  if (existing && existing.status !== "sent") {
    return <ResponseStatusCard response={existing} />;
  }

  return (
    <ResponseEditor
      requestId={requestId}
      existing={existing}
      portfolioOptions={portfolioOptions}
    />
  );
}

function ResponseEditor({
  requestId,
  existing,
  portfolioOptions,
}: {
  requestId: string;
  existing: ResponseView | null;
  portfolioOptions: PortfolioItemOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState(existing?.message ?? "");
  const [priceModel, setPriceModel] = useState<PricingModel | "">(
    existing?.priceModel ?? "",
  );
  const [priceNote, setPriceNote] = useState(existing?.priceNote ?? "");
  const [availability, setAvailability] = useState(existing?.availability ?? "");
  const [selected, setSelected] = useState<Set<string>>(
    new Set(existing?.portfolioItems.map((p) => p.id) ?? []),
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submit() {
    startTransition(async () => {
      const input = {
        message,
        priceModel,
        priceNote,
        availability,
        portfolioProjectIds: [...selected],
      };
      const res = existing
        ? await updateResponseAction(existing.id, input)
        : await submitResponseAction(requestId, input);
      if (res.ok) {
        toast.success(existing ? "Reakce upravena." : "Reakce odeslána.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function withdraw() {
    if (!existing) return;
    startTransition(async () => {
      const res = await withdrawResponseAction(existing.id);
      if (res.ok) {
        toast.success("Reakce stažena.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Card>
      <CardContent className="space-y-5 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">
            {existing ? "Upravit reakci" : "Reagovat na poptávku"}
          </p>
          {existing ? (
            <Badge variant="outline">{RESPONSE_STATUS_LABELS[existing.status]}</Badge>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="resp-message">Zpráva</Label>
          <Textarea
            id="resp-message"
            value={message}
            placeholder="Popište svůj zájem, přístup a proč jste vhodná volba…"
            rows={5}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="resp-price-model">Cenový model</Label>
            <Select
              value={priceModel}
              onValueChange={(v) => setPriceModel(v as typeof priceModel)}
            >
              <SelectTrigger id="resp-price-model">
                <SelectValue placeholder="Neuvedeno" />
              </SelectTrigger>
              <SelectContent>
                {PRICING_MODELS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {PRICING_MODEL_LABELS[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="resp-availability">Orientační termín</Label>
            <Input
              id="resp-availability"
              value={availability}
              placeholder="Neuvedeno"
              onChange={(e) => setAvailability(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="resp-price-note">Poznámka k ceně (nepovinné)</Label>
          <Input
            id="resp-price-note"
            value={priceNote}
            placeholder="Např. „od 1 500 Kč/h“"
            onChange={(e) => setPriceNote(e.target.value)}
          />
        </div>

        {portfolioOptions.length > 0 ? (
          <div className="space-y-2">
            <Label>Přiložit portfolio (nepovinné)</Label>
            <div className="flex flex-wrap gap-2">
              {portfolioOptions.map((p) => {
                const on = selected.has(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggle(p.id)}
                    aria-pressed={on}
                    className={
                      on
                        ? "bg-primary text-primary-foreground rounded-full px-3 py-1 text-sm"
                        : "border-input text-muted-foreground rounded-full border px-3 py-1 text-sm"
                    }
                  >
                    {p.title}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button onClick={submit} disabled={pending || message.trim().length === 0}>
            {pending ? <Loader2 className="animate-spin" /> : <Send />}
            {existing ? "Uložit úpravy" : "Odeslat reakci"}
          </Button>
          {existing && authorActions(existing.status).includes("withdraw") ? (
            <Button variant="ghost" onClick={withdraw} disabled={pending}>
              <Undo2 />
              Stáhnout reakci
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

/** Reakce mimo `sent` — jen stav, bez editace (§ Main flow bod 4). */
function ResponseStatusCard({ response }: { response: ResponseView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const canWithdraw = authorActions(response.status).includes("withdraw");

  function withdraw() {
    startTransition(async () => {
      const res = await withdrawResponseAction(response.id);
      if (res.ok) {
        toast.success("Reakce stažena.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">Vaše reakce</p>
          <Badge variant="outline">{RESPONSE_STATUS_LABELS[response.status]}</Badge>
        </div>
        <p className="text-sm whitespace-pre-wrap">{response.message}</p>
        {response.status === "rejected" && response.rejectionReason ? (
          <p className="text-muted-foreground text-sm">
            Důvod odmítnutí: {response.rejectionReason}
          </p>
        ) : null}
        {canWithdraw ? (
          <Button variant="ghost" onClick={withdraw} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Undo2 />}
            Stáhnout reakci
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
