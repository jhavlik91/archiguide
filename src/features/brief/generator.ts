/**
 * Generátor briefu (T021). ČISTÁ funkce (bez DB / `next/*`) — plně testovatelná.
 *
 * Mapuje dokončenou guide session (definice scénáře + efektivní odpovědi + shrnutí
 * T018 + rozřešený výsledek T020) na strukturovaný `BriefContent` se všemi
 * povinnými částmi §18. Datová vrstva (`service.ts`) jen dodá vstupy z DB a
 * výsledek perzistuje.
 *
 * ZÁSADY (zadani/16 §4, acceptance):
 * - „nevím"/„přeskočit" se propíšou POCTIVĚ jako neznámé/chybějící — žádné
 *   dopočítané hodnoty (rozpočet „neuveden", ne vymyšlené číslo);
 * - přesná adresa zůstává jen v SOUKROMÉM poli `location.address`, nikdy v názvu
 *   ani ve shrnutí (zadani/09 — Brief);
 * - shrnutí je lidský popis (věty), ne výpis odpovědí;
 * - doporučené profese nesou DŮVOD (převzato z výstupů T020).
 */

import { formatAnswer } from "@/features/guide";
import type {
  GuideAnswers,
  GuideFileRefValue,
  GuideLocationValue,
  GuideRangeValue,
  GuideResult,
  GuideScenarioDefinition,
  GuideStepDefinition,
  GuideSummary,
} from "@/features/guide";
import {
  BRIEF_TITLE_MAX_LENGTH,
  type BriefBudget,
  type BriefContent,
  type BriefDetail,
  type BriefInputs,
  type BriefLocation,
  type BriefProfession,
} from "./types";

/** Vstupy generátoru — vše, co service načte/spočítá z DB a enginu. */
export interface GuideBriefSource {
  def: GuideScenarioDefinition;
  /** Efektivní odpovědi (bez stale větví), stejné jako v náhledu session. */
  answers: GuideAnswers;
  summary: GuideSummary;
  result: GuideResult;
}

// --- Sémantické klíče kroků -------------------------------------------------
//
// Guide je datově řízený, ale OBECNÉ otázky (§9) mají stabilní klíče napříč
// scénáři (`features/guide/scenarios.ts`). Podle nich se odpovědi zařadí do
// pevných sekcí §18; cokoli neznámého padá poctivě do „Preferencí".

const LOCATION_KEY = "location";
const TIMING_KEY = "timing";
const ATTACHMENTS_KEY = "attachments";
const BUDGET_KNOWN_KEY = "budget_known";
const BUDGET_SCOPE_KEY = "budget_scope";
const BUDGET_AMOUNT_KEY = "budget_amount";
const BUDGET_RANGE_KEY = "budget_range";

/** Kroky popisující AKTUÁLNÍ STAV (vlastnictví, fáze, stáří). */
const CURRENT_STATE_KEYS = ["ownership", "stage", "age"];
/** Kroky popisující ROZSAH záměru. */
const SCOPE_KEYS = ["scope", "size", "service", "space", "depth"];

/** Klíče konzumované vyhrazenými sekcemi — do „Preferencí" už nepadají. */
const RESERVED_KEYS = new Set<string>([
  LOCATION_KEY,
  TIMING_KEY,
  ATTACHMENTS_KEY,
  BUDGET_KNOWN_KEY,
  BUDGET_SCOPE_KEY,
  BUDGET_AMOUNT_KEY,
  BUDGET_RANGE_KEY,
  ...CURRENT_STATE_KEYS,
  ...SCOPE_KEYS,
]);

// --- Pomůcky ----------------------------------------------------------------

/** Vrátí uloženou HODNOTNOU odpověď kroku (jen `answered`), jinak `undefined`. */
function answeredValue(
  answers: GuideAnswers,
  key: string,
): unknown | undefined {
  const answer = answers[key];
  return answer && answer.status === "answered" ? answer.value : undefined;
}

/** Lidský popisek `answered` odpovědi kroku (přes definici pro option labely). */
function labelFor(
  stepByKey: Map<string, GuideStepDefinition>,
  answers: GuideAnswers,
  key: string,
): string | null {
  const step = stepByKey.get(key);
  const answer = answers[key];
  if (!step || !answer || answer.status !== "answered") return null;
  return formatAnswer(step, answer);
}

const czk = new Intl.NumberFormat("cs-CZ");
function formatCzk(value: number): string {
  return `${czk.format(value)} Kč`;
}

/** Veřejná lokalita bez přesné adresy (město/region/přibližně). */
function locationDisplay(loc: GuideLocationValue): string {
  const parts = [loc.city, loc.municipality, loc.region, loc.country].filter(
    (p): p is string => typeof p === "string" && p.trim().length > 0,
  );
  if (parts.length > 0) return parts.join(", ");
  return loc.approximate?.trim() ?? "";
}

// --- Jednotlivé sekce §18 ---------------------------------------------------

function buildLocation(answers: GuideAnswers): BriefLocation | null {
  const value = answeredValue(answers, LOCATION_KEY) as
    GuideLocationValue | undefined;
  if (!value) return null;
  const display = locationDisplay(value);
  const shareAddress = value.shareAddress === true;
  // Přesná adresa je SOUKROMÁ — drží se, ale mimo `display` (zadani/09 — Brief).
  const address =
    typeof value.address === "string" && value.address.trim().length > 0
      ? value.address.trim()
      : undefined;
  if (display.length === 0 && !address) return null;
  return { display, shareAddress, ...(address ? { address } : {}) };
}

function buildBudget(
  stepByKey: Map<string, GuideStepDefinition>,
  answers: GuideAnswers,
): BriefBudget {
  const scopeLabel =
    labelFor(stepByKey, answers, BUDGET_SCOPE_KEY) ?? undefined;
  const withScope = (b: BriefBudget): BriefBudget =>
    scopeLabel ? { ...b, scope: scopeLabel } : b;

  const known = answeredValue(answers, BUDGET_KNOWN_KEY) as string | undefined;

  if (known === "exact") {
    const amount = answeredValue(answers, BUDGET_AMOUNT_KEY);
    if (typeof amount === "number") {
      return withScope({ known: true, display: formatCzk(amount) });
    }
  }
  if (known === "range") {
    const range = answeredValue(answers, BUDGET_RANGE_KEY) as
      GuideRangeValue | undefined;
    if (range && (range.min != null || range.max != null)) {
      const { min, max } = range;
      const display =
        min != null && max != null
          ? `${formatCzk(min)} – ${formatCzk(max)}`
          : min != null
            ? `od ${formatCzk(min)}`
            : `do ${formatCzk(max as number)}`;
      return withScope({ known: true, display });
    }
  }
  // „estimate" (potřebuje odhad), „unknown"/„Neznám", „nevím"/„přeskočit" i chybějící
  // krok → poctivě „neuveden", NIKDY dopočítané číslo (acceptance).
  const display =
    known === "estimate"
      ? "Rozpočet neuveden – klient potřebuje odhad"
      : "Rozpočet neuveden";
  return withScope({ known: false, display });
}

function joinAnswered(
  stepByKey: Map<string, GuideStepDefinition>,
  answers: GuideAnswers,
  keys: string[],
): string | null {
  const parts = keys
    .map((key) => labelFor(stepByKey, answers, key))
    .filter((p): p is string => p !== null && p.trim().length > 0);
  return parts.length > 0 ? parts.join(", ") : null;
}

function buildInputs(answers: GuideAnswers): BriefInputs {
  const value = answeredValue(answers, ATTACHMENTS_KEY) as
    GuideFileRefValue | undefined;
  const mediaIds = Array.isArray(value?.mediaIds) ? value.mediaIds : [];
  return { count: mediaIds.length, mediaIds };
}

function buildPreferences(source: GuideBriefSource): BriefDetail[] {
  const stepByKey = new Map(source.def.steps.map((s) => [s.key, s]));
  const details: BriefDetail[] = [];
  for (const item of source.summary.items) {
    if (RESERVED_KEYS.has(item.key)) continue;
    if (item.answer.status !== "answered") continue; // neznámé/přeskočené sem nepatří
    const step = stepByKey.get(item.key);
    if (!step) continue;
    details.push({
      key: item.key,
      label: item.prompt,
      value: formatAnswer(step, item.answer),
    });
  }
  return details;
}

/** Rizika a nejasnosti (§18): rozpory + „málo informací" + bezpečnostní signál. */
function buildRisks(result: GuideResult): string[] {
  const risks: string[] = result.conflicts.map((c) => c.message);
  if (result.lowConfidence) {
    risks.push(
      "Zůstalo mnoho nejasného — bez upřesnění nelze dát konkrétní doporučení; vhodná je nezávazná konzultace.",
    );
  }
  if (result.safetyOutcomes.length > 0) {
    risks.push(
      "Záměr může nést bezpečnostní rizika — je namístě odborné posouzení (viz doporučení níže).",
    );
  }
  return risks;
}

/** Doporučené profese s DŮVODEM (§18); dedup dle slugu, důvod z prvního výskytu. */
function buildProfessions(result: GuideResult): BriefProfession[] {
  const seen = new Map<string, BriefProfession>();
  for (const outcome of result.outcomes) {
    for (const profession of outcome.professions) {
      if (seen.has(profession.slug)) continue;
      seen.set(profession.slug, {
        slug: profession.slug,
        name: profession.name,
        reason: outcome.nextStep,
      });
    }
  }
  return [...seen.values()];
}

/**
 * Shrnutí — lidský popis záměru z dostupných faktů (§18). Věty, ne výpis
 * odpovědí; neznámé sekce se poctivě vynechají. Nikdy neobsahuje přesnou adresu
 * (staví se z `location.display`).
 */
function buildSummary(params: {
  projectType: string;
  location: BriefLocation | null;
  currentState: string | null;
  scope: string | null;
  budget: BriefBudget;
  timing: string | null;
  lowConfidence: boolean;
}): string {
  const sentences: string[] = [];
  const place = params.location ? ` v lokalitě ${params.location.display}` : "";
  sentences.push(`Záměr: ${params.projectType}${place}.`);

  if (params.currentState) {
    sentences.push(`Aktuální stav: ${params.currentState}.`);
  }
  if (params.scope) {
    sentences.push(`Rozsah: ${params.scope}.`);
  }
  if (params.budget.known) {
    sentences.push(`Rozpočet: ${params.budget.display}.`);
  }
  if (params.timing) {
    sentences.push(`Časový horizont: ${params.timing}.`);
  }
  if (params.lowConfidence) {
    sentences.push(
      "Zatím je mnoho otázek otevřených — brief slouží jako výchozí bod ke konzultaci.",
    );
  }
  return sentences.join(" ");
}

/** Zkrátí text na max délku názvu bez rozseknutí uprostřed slova. */
function truncateTitle(text: string): string {
  if (text.length <= BRIEF_TITLE_MAX_LENGTH) return text;
  const cut = text.slice(0, BRIEF_TITLE_MAX_LENGTH);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}

/**
 * Automaticky navržený název briefu (§18), editovatelný v T022. Typ projektu +
 * veřejná lokalita; NIKDY přesná adresa (staví se z `location.display`).
 */
export function suggestBriefTitle(source: GuideBriefSource): string {
  const location = buildLocation(source.answers);
  const base = source.def.name;
  const title = location ? `${base} – ${location.display}` : base;
  return truncateTitle(title);
}

/** Sestaví celý snapshot obsahu briefu (§18) z dokončené session. */
export function generateBriefContent(source: GuideBriefSource): BriefContent {
  const stepByKey = new Map(source.def.steps.map((s) => [s.key, s]));

  const projectType = source.def.name;
  const location = buildLocation(source.answers);
  const currentState = joinAnswered(
    stepByKey,
    source.answers,
    CURRENT_STATE_KEYS,
  );
  const scope = joinAnswered(stepByKey, source.answers, SCOPE_KEYS);
  const budget = buildBudget(stepByKey, source.answers);
  const timing = labelFor(stepByKey, source.answers, TIMING_KEY);

  const summary = buildSummary({
    projectType,
    location,
    currentState,
    scope,
    budget,
    timing,
    lowConfidence: source.result.lowConfidence,
  });

  return {
    version: 1,
    summary,
    goal: location ? `${projectType} – ${location.display}` : projectType,
    projectType,
    currentState,
    scope,
    location,
    budget,
    timing,
    inputs: buildInputs(source.answers),
    missingInputs: source.summary.missing.map((m) => m.prompt),
    preferences: buildPreferences(source),
    risks: buildRisks(source.result),
    recommendedProfessions: buildProfessions(source.result),
    nextStep: source.result.outcomes[0]?.nextStep ?? null,
  };
}
