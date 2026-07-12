"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import type {
  GuideAnswer,
  GuideAnswerValue,
  GuideLocationValue,
  GuideRangeValue,
  GuideStepDefinition,
} from "../types";

/**
 * Vstupní ovládací prvek jednoho kroku guide (T018). Řízený: rodič (runner) drží
 * `draft` a dostává změny přes `onChange`. Server zůstává autoritou — tady jde
 * jen o pohodlné zadání; platnost hodnoty potvrdí `validateAnswer` na serveru.
 */

/** „Rozpracovaná" hodnota odpovědi (před odesláním). */
export type Draft = GuideAnswerValue | undefined;

/** Typy, u kterých MVP UI umí zadat hodnotu (`file_ref` = jen přeskočit, T023). */
export function stepSupportsAnswer(step: GuideStepDefinition): boolean {
  return step.type !== "file_ref";
}

/** Předvyplní draft z uložené odpovědi (jen `answered` nese hodnotu). */
export function answerToDraft(answer: GuideAnswer | undefined): Draft {
  return answer && answer.status === "answered" ? answer.value : undefined;
}

/** Je draft „hodnotný" (lze z něj poslat `answered`)? Řídí aktivaci „Pokračovat". */
export function isDraftComplete(
  step: GuideStepDefinition,
  draft: Draft,
): boolean {
  switch (step.type) {
    case "single_choice":
      return typeof draft === "string" && draft.length > 0;
    case "multi_choice": {
      const min = step.config?.minSelected ?? 1;
      return Array.isArray(draft) && draft.length >= min;
    }
    case "text":
      return typeof draft === "string" && draft.trim().length > 0;
    case "number":
      return typeof draft === "number" && Number.isFinite(draft);
    case "range": {
      const r = draft as GuideRangeValue | undefined;
      return !!r && (typeof r.min === "number" || typeof r.max === "number");
    }
    case "location": {
      const l = draft as GuideLocationValue | undefined;
      if (!l) return false;
      return (
        ["city", "region", "municipality", "approximate", "address"] as const
      ).some(
        (k) => typeof l[k] === "string" && (l[k] as string).trim().length > 0,
      );
    }
    default:
      return false;
  }
}

export function StepInput({
  step,
  draft,
  onChange,
}: {
  step: GuideStepDefinition;
  draft: Draft;
  onChange: (draft: Draft) => void;
}) {
  switch (step.type) {
    case "single_choice":
      return (
        <SingleChoice
          step={step}
          value={draft as string | undefined}
          onChange={onChange}
        />
      );
    case "multi_choice":
      return (
        <MultiChoice
          step={step}
          value={(draft as string[]) ?? []}
          onChange={onChange}
        />
      );
    case "text":
      return (
        <Textarea
          autoFocus
          value={(draft as string) ?? ""}
          maxLength={step.config?.maxLength}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Napište svou odpověď…"
          className="min-h-32"
        />
      );
    case "number":
      return (
        <NumberInput
          value={draft as number | undefined}
          min={step.config?.min}
          max={step.config?.max}
          onChange={onChange}
        />
      );
    case "range":
      return (
        <RangeInput
          value={draft as GuideRangeValue | undefined}
          onChange={onChange}
        />
      );
    case "location":
      return (
        <LocationInput
          value={draft as GuideLocationValue | undefined}
          onChange={onChange}
        />
      );
    case "file_ref":
      return (
        <p className="text-muted-foreground rounded-md border border-dashed p-4 text-sm">
          Podklady (fotky, půdorysy, dokumentaci) přiložíte později u konkrétní
          poptávky. Teď můžete krok přeskočit.
        </p>
      );
    default:
      return null;
  }
}

function SingleChoice({
  step,
  value,
  onChange,
}: {
  step: GuideStepDefinition;
  value: string | undefined;
  onChange: (v: Draft) => void;
}) {
  return (
    <RadioGroup
      value={value ?? ""}
      onValueChange={(v) => onChange(v)}
      className="gap-2"
    >
      {(step.options ?? []).map((option) => {
        const id = `${step.key}-${option.value}`;
        const active = value === option.value;
        return (
          <Label
            key={option.value}
            htmlFor={id}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors",
              active ? "border-primary bg-accent" : "hover:bg-accent/50",
            )}
          >
            <RadioGroupItem id={id} value={option.value} className="mt-0.5" />
            <span className="space-y-0.5">
              <span className="block text-sm font-medium">{option.label}</span>
              {option.help ? (
                <span className="text-muted-foreground block text-xs">
                  {option.help}
                </span>
              ) : null}
            </span>
          </Label>
        );
      })}
    </RadioGroup>
  );
}

function MultiChoice({
  step,
  value,
  onChange,
}: {
  step: GuideStepDefinition;
  value: string[];
  onChange: (v: Draft) => void;
}) {
  function toggle(optionValue: string, checked: boolean) {
    const next = checked
      ? [...value, optionValue]
      : value.filter((v) => v !== optionValue);
    onChange(next.length > 0 ? next : []);
  }
  return (
    <div className="grid gap-2">
      {(step.options ?? []).map((option) => {
        const id = `${step.key}-${option.value}`;
        const checked = value.includes(option.value);
        return (
          <Label
            key={option.value}
            htmlFor={id}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors",
              checked ? "border-primary bg-accent" : "hover:bg-accent/50",
            )}
          >
            <Checkbox
              id={id}
              checked={checked}
              onCheckedChange={(c) => toggle(option.value, c === true)}
              className="mt-0.5"
            />
            <span className="space-y-0.5">
              <span className="block text-sm font-medium">{option.label}</span>
              {option.help ? (
                <span className="text-muted-foreground block text-xs">
                  {option.help}
                </span>
              ) : null}
            </span>
          </Label>
        );
      })}
    </div>
  );
}

function NumberInput({
  value,
  min,
  max,
  onChange,
}: {
  value: number | undefined;
  min?: number;
  max?: number;
  onChange: (v: Draft) => void;
}) {
  return (
    <Input
      autoFocus
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={value ?? ""}
      onChange={(e) =>
        onChange(e.target.value === "" ? undefined : Number(e.target.value))
      }
      placeholder="Zadejte částku v Kč"
    />
  );
}

function RangeInput({
  value,
  onChange,
}: {
  value: GuideRangeValue | undefined;
  onChange: (v: Draft) => void;
}) {
  const min = value?.min ?? null;
  const max = value?.max ?? null;
  function set(part: "min" | "max", raw: string) {
    const num = raw === "" ? null : Number(raw);
    onChange({ min, max, [part]: num });
  }
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 space-y-1">
        <Label htmlFor="range-min">Od (Kč)</Label>
        <Input
          id="range-min"
          type="number"
          inputMode="numeric"
          value={min ?? ""}
          onChange={(e) => set("min", e.target.value)}
        />
      </div>
      <span className="text-muted-foreground mt-6">–</span>
      <div className="flex-1 space-y-1">
        <Label htmlFor="range-max">Do (Kč)</Label>
        <Input
          id="range-max"
          type="number"
          inputMode="numeric"
          value={max ?? ""}
          onChange={(e) => set("max", e.target.value)}
        />
      </div>
    </div>
  );
}

function LocationInput({
  value,
  onChange,
}: {
  value: GuideLocationValue | undefined;
  onChange: (v: Draft) => void;
}) {
  const loc = value ?? {};
  function patch(next: Partial<GuideLocationValue>) {
    onChange({ ...loc, ...next });
  }
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="loc-city">Město / obec</Label>
          <Input
            id="loc-city"
            autoFocus
            value={loc.city ?? ""}
            onChange={(e) => patch({ city: e.target.value })}
            placeholder="Např. Praha"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="loc-region">Kraj / region</Label>
          <Input
            id="loc-region"
            value={loc.region ?? ""}
            onChange={(e) => patch({ region: e.target.value })}
            placeholder="Např. Středočeský"
          />
        </div>
      </div>
      <Label
        htmlFor="loc-share"
        className="flex cursor-pointer items-center gap-2 text-sm"
      >
        <Checkbox
          id="loc-share"
          checked={loc.shareAddress === true}
          onCheckedChange={(c) =>
            patch({
              shareAddress: c === true,
              ...(c === true ? {} : { address: undefined }),
            })
          }
        />
        Chci uvést i přesnou adresu (sdílí se jen se souhlasem)
      </Label>
      {loc.shareAddress ? (
        <Input
          value={loc.address ?? ""}
          onChange={(e) => patch({ address: e.target.value })}
          placeholder="Ulice a číslo popisné"
        />
      ) : null}
    </div>
  );
}
