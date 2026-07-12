/**
 * Čisté formátování odpovědí guide do čitelného textu (T018). Bez DB / `next/*`,
 * použitelné v klientských komponentách i unit testech. Slouží shrnutí (postranní
 * panel, obrazovka dokončení) — hodnoty se zobrazují lidsky, ne jako JSON.
 */

import type {
  GuideAnswer,
  GuideFileRefValue,
  GuideLocationValue,
  GuideRangeValue,
  GuideStepDefinition,
} from "./types";

/** Popisek stavu „nevím"/„přeskočit" pro shrnutí. */
export const GUIDE_ANSWER_STATUS_LABELS = {
  unknown: "Nevím",
  skipped: "Přeskočeno",
} as const;

const czk = new Intl.NumberFormat("cs-CZ");

/** Formátuje částku v Kč (bez desetinných míst). */
function formatCzk(value: number): string {
  return `${czk.format(value)} Kč`;
}

/** Popisek možnosti single/multi-choice podle `value` (fallback na value). */
function optionLabel(step: GuideStepDefinition, value: string): string {
  return step.options?.find((o) => o.value === value)?.label ?? value;
}

function formatLocation(loc: GuideLocationValue): string {
  const parts = [loc.city, loc.municipality, loc.region, loc.country].filter(
    (p): p is string => typeof p === "string" && p.trim().length > 0,
  );
  const base = parts.length > 0 ? parts.join(", ") : (loc.approximate ?? "");
  if (loc.shareAddress && loc.address) return `${base} (${loc.address})`;
  return base || "—";
}

function formatRange(range: GuideRangeValue): string {
  const { min, max } = range;
  if (min != null && max != null)
    return `${formatCzk(min)} – ${formatCzk(max)}`;
  if (min != null) return `od ${formatCzk(min)}`;
  if (max != null) return `do ${formatCzk(max)}`;
  return "—";
}

/**
 * Vrátí lidsky čitelnou hodnotu uložené odpovědi vzhledem k definici kroku.
 * „nevím"/„přeskočit" vrací příslušný popisek; `answered` formátuje podle typu.
 */
export function formatAnswer(
  step: GuideStepDefinition,
  answer: GuideAnswer,
): string {
  if (answer.status === "unknown") return GUIDE_ANSWER_STATUS_LABELS.unknown;
  if (answer.status === "skipped") return GUIDE_ANSWER_STATUS_LABELS.skipped;

  const value = answer.value;
  switch (step.type) {
    case "single_choice":
      return typeof value === "string" ? optionLabel(step, value) : "—";
    case "multi_choice":
      return Array.isArray(value)
        ? value.map((v) => optionLabel(step, v)).join(", ")
        : "—";
    case "text":
      return typeof value === "string" ? value : "—";
    case "number":
      return typeof value === "number" ? formatCzk(value) : "—";
    case "range":
      return formatRange(value as GuideRangeValue);
    case "location":
      return formatLocation(value as GuideLocationValue);
    case "file_ref": {
      const count = (value as GuideFileRefValue)?.mediaIds?.length ?? 0;
      return count === 1 ? "1 podklad" : `${count} podkladů`;
    }
    default:
      return "—";
  }
}
