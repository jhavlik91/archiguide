"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  CloudOff,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { saveBriefContentAction } from "../actions";
import type { BriefView } from "../types";

/**
 * Editor briefu (T022 § Main flow 1). Všechny sekce §18 jsou editovatelné
 * formulářem (ne volný text celého briefu). AUTOSAVE (debounce) po každé změně —
 * nikdy neztratit rozpracované změny (zadani/16 §8); explicitní „Hotovo" ještě
 * flushne a vrátí na náhled. Odvozená pole (chybějící/dostupné podklady) editor
 * nemění — server je při merge zachová.
 *
 * Editace SDÍLENÉHO briefu ho na serveru posune `shared → revised`; horní pruh
 * proto upozorní, že se sdílená verze rozejde s úpravami.
 */

type FormState = {
  title: string;
  summary: string;
  goal: string;
  projectType: string;
  currentState: string;
  scope: string;
  timing: string;
  nextStep: string;
  locationDisplay: string;
  locationAddress: string;
  shareAddress: boolean;
  budgetKnown: boolean;
  budgetDisplay: string;
  budgetScope: string;
  preferences: { key: string; label: string; value: string }[];
  risks: string[];
  professions: { slug: string; name: string; reason: string }[];
};

type SaveState = "idle" | "saving" | "saved" | "error";

function initialState(brief: BriefView): FormState {
  const c = brief.content;
  return {
    title: brief.title,
    summary: c.summary,
    goal: c.goal,
    projectType: c.projectType,
    currentState: c.currentState ?? "",
    scope: c.scope ?? "",
    timing: c.timing ?? "",
    nextStep: c.nextStep ?? "",
    locationDisplay: c.location?.display ?? "",
    locationAddress: c.location?.address ?? "",
    shareAddress: c.location?.shareAddress ?? false,
    budgetKnown: c.budget.known,
    budgetDisplay: c.budget.known ? c.budget.display : "",
    budgetScope: c.budget.scope ?? "",
    preferences: c.preferences.map((p) => ({ ...p })),
    risks: [...c.risks],
    professions: c.recommendedProfessions.map((p) => ({ ...p })),
  };
}

function toPayload(f: FormState) {
  return {
    title: f.title,
    summary: f.summary,
    goal: f.goal,
    projectType: f.projectType,
    currentState: f.currentState,
    scope: f.scope,
    timing: f.timing,
    nextStep: f.nextStep,
    location: {
      display: f.locationDisplay,
      address: f.locationAddress || undefined,
      shareAddress: f.shareAddress,
    },
    budget: {
      known: f.budgetKnown,
      display: f.budgetDisplay,
      scope: f.budgetScope || undefined,
    },
    preferences: f.preferences,
    risks: f.risks,
    recommendedProfessions: f.professions,
  };
}

export function BriefEditor({ brief }: { brief: BriefView }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => initialState(brief));
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNext = useRef(true);
  // Nejnovější stav pro flush při odchodu (uzávěr v timeoutu jinak zamrzne).
  const latest = useRef(form);
  latest.current = form;

  const save = useCallback(
    async (state: FormState) => {
      setSaveState("saving");
      const res = await saveBriefContentAction(brief.id, toPayload(state));
      if (res.ok) {
        setSaveState("saved");
      } else {
        setSaveState("error");
        toast.error(res.error);
      }
      return res.ok;
    },
    [brief.id],
  );

  // Autosave: debounce 800 ms po poslední změně.
  useEffect(() => {
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    setSaveState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(latest.current), 800);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [form, save]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function done() {
    if (timer.current) clearTimeout(timer.current);
    const ok = await save(latest.current);
    if (ok) router.push(`/brief/${brief.id}`);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      {/* Sticky pruh: zpět + stav ukládání + hotovo. */}
      <div className="bg-background/80 sticky top-0 z-10 -mx-4 flex items-center justify-between gap-2 border-b px-4 py-3 backdrop-blur">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/brief/${brief.id}`}>
            <ArrowLeft />
            Náhled
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <SaveIndicator state={saveState} />
          <Button size="sm" onClick={done} disabled={saveState === "saving"}>
            Hotovo
          </Button>
        </div>
      </div>

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Upravit brief</h1>
        <p className="text-muted-foreground text-sm">
          Změny se ukládají průběžně. Odvozené sekce (dostupné a chybějící
          podklady) se přebírají z odpovědí v průvodci.
        </p>
        {brief.status === "shared" || brief.status === "revised" ? (
          <p className="text-warning text-sm">
            Brief je sdílený — úpravy uvidí příjemci až po opětovném sdílení.
          </p>
        ) : null}
      </div>

      <Field label="Název briefu" htmlFor="title">
        <Input
          id="title"
          value={form.title}
          maxLength={160}
          onChange={(e) => update("title", e.target.value)}
        />
      </Field>

      <Section title="Shrnutí">
        <Field label="Shrnutí záměru" htmlFor="summary">
          <Textarea
            id="summary"
            rows={4}
            value={form.summary}
            onChange={(e) => update("summary", e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Základní fakta">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cíl" htmlFor="goal">
            <Textarea
              id="goal"
              rows={2}
              value={form.goal}
              onChange={(e) => update("goal", e.target.value)}
            />
          </Field>
          <Field label="Typ projektu" htmlFor="projectType">
            <Input
              id="projectType"
              value={form.projectType}
              onChange={(e) => update("projectType", e.target.value)}
            />
          </Field>
          <Field label="Aktuální stav" htmlFor="currentState">
            <Input
              id="currentState"
              value={form.currentState}
              onChange={(e) => update("currentState", e.target.value)}
            />
          </Field>
          <Field label="Rozsah" htmlFor="scope">
            <Input
              id="scope"
              value={form.scope}
              onChange={(e) => update("scope", e.target.value)}
            />
          </Field>
          <Field label="Časový horizont" htmlFor="timing">
            <Input
              id="timing"
              value={form.timing}
              onChange={(e) => update("timing", e.target.value)}
            />
          </Field>
        </div>
      </Section>

      <Section title="Lokalita">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Město / region (veřejné)" htmlFor="locDisplay">
            <Input
              id="locDisplay"
              value={form.locationDisplay}
              onChange={(e) => update("locationDisplay", e.target.value)}
            />
          </Field>
          <Field
            label="Přesná adresa (soukromá)"
            htmlFor="locAddress"
            hint="Nesdílí se ani neexportuje bez vašeho svolení."
          >
            <Input
              id="locAddress"
              value={form.locationAddress}
              onChange={(e) => update("locationAddress", e.target.value)}
            />
          </Field>
        </div>
        <label className="mt-1 flex items-center gap-2 text-sm">
          <Checkbox
            checked={form.shareAddress}
            onCheckedChange={(v) => update("shareAddress", v === true)}
          />
          Souhlasím s pozdějším sdílením přesné adresy vybranému profesionálovi
        </label>
      </Section>

      <Section title="Rozpočet">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={form.budgetKnown}
            onCheckedChange={(v) => update("budgetKnown", v === true)}
          />
          Rozpočet je znám
        </label>
        {form.budgetKnown ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Částka / rozsah" htmlFor="budgetDisplay">
              <Input
                id="budgetDisplay"
                placeholder="např. 2 000 000 Kč nebo 1,5–2 mil. Kč"
                value={form.budgetDisplay}
                onChange={(e) => update("budgetDisplay", e.target.value)}
              />
            </Field>
            <Field label="Čeho se týká" htmlFor="budgetScope">
              <Input
                id="budgetScope"
                placeholder="např. realizace, projekt"
                value={form.budgetScope}
                onChange={(e) => update("budgetScope", e.target.value)}
              />
            </Field>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm italic">
            Rozpočet zůstane uvedený jako „neuveden“ — nedopočítáváme žádné
            číslo.
          </p>
        )}
      </Section>

      {form.preferences.length > 0 ? (
        <Section title="Preference">
          <div className="space-y-3">
            {form.preferences.map((pref, i) => (
              <Field
                key={pref.key}
                label={pref.label}
                htmlFor={`pref-${pref.key}`}
              >
                <Input
                  id={`pref-${pref.key}`}
                  value={pref.value}
                  onChange={(e) =>
                    update(
                      "preferences",
                      form.preferences.map((p, j) =>
                        j === i ? { ...p, value: e.target.value } : p,
                      ),
                    )
                  }
                />
              </Field>
            ))}
          </div>
        </Section>
      ) : null}

      <Section title="Rizika a nejasnosti">
        <div className="space-y-2">
          {form.risks.map((risk, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={risk}
                aria-label={`Riziko ${i + 1}`}
                onChange={(e) =>
                  update(
                    "risks",
                    form.risks.map((r, j) => (j === i ? e.target.value : r)),
                  )
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Odebrat riziko"
                onClick={() =>
                  update(
                    "risks",
                    form.risks.filter((_, j) => j !== i),
                  )
                }
              >
                <Trash2 />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => update("risks", [...form.risks, ""])}
          >
            <Plus />
            Přidat riziko
          </Button>
        </div>
      </Section>

      {form.professions.length > 0 ? (
        <Section title="Doporučené profese">
          <div className="space-y-4">
            {form.professions.map((prof, i) => (
              <div key={prof.slug} className="space-y-2">
                <Badge>{prof.name || prof.slug}</Badge>
                <Field label="Důvod doporučení" htmlFor={`prof-${prof.slug}`}>
                  <Textarea
                    id={`prof-${prof.slug}`}
                    rows={2}
                    value={prof.reason}
                    onChange={(e) =>
                      update(
                        "professions",
                        form.professions.map((p, j) =>
                          j === i ? { ...p, reason: e.target.value } : p,
                        ),
                      )
                    }
                  />
                </Field>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      <Section title="Doporučený další krok">
        <Field label="Další krok" htmlFor="nextStep">
          <Textarea
            id="nextStep"
            rows={2}
            value={form.nextStep}
            onChange={(e) => update("nextStep", e.target.value)}
          />
        </Field>
      </Section>
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "saving") {
    return (
      <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
        <Loader2 className="size-4 animate-spin" />
        Ukládání…
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="text-success flex items-center gap-1.5 text-sm">
        <Check className="size-4" />
        Uloženo
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="text-destructive flex items-center gap-1.5 text-sm">
        <CloudOff className="size-4" />
        Neuloženo
      </span>
    );
  }
  return null;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="space-y-4 p-5 sm:p-6">
        <h2 className="text-sm font-semibold">{title}</h2>
        {children}
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  );
}
