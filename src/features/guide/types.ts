/**
 * Sdílené typy guide enginu (T017).
 *
 * Guide je DATOVĚ řízený: scénář a jeho kroky jsou data (viz `prisma/schema.prisma`
 * — GuideScenario/GuideStep/GuideSession), engine je čistá funkce nad definicí a
 * odpověďmi. Tento modul je čistý (bez DB a bez `next/*`), aby ho šlo použít i v
 * klientských komponentách (T018) a plně pokrýt unit testy.
 *
 * Hodnoty enumů zrcadlí Prisma enumy (`GuideStepType`, `GuideSessionState`).
 */

// --- Typy otázek ------------------------------------------------------------

export const GUIDE_STEP_TYPES = [
  "single_choice",
  "multi_choice",
  "text",
  "number",
  "range",
  "location",
  "file_ref",
] as const;
export type GuideStepType = (typeof GUIDE_STEP_TYPES)[number];

/** Popisky typů otázek pro admin/přehled (čeština). */
export const GUIDE_STEP_TYPE_LABELS: Record<GuideStepType, string> = {
  single_choice: "Jedna možnost",
  multi_choice: "Více možností",
  text: "Text",
  number: "Číslo",
  range: "Rozpětí",
  location: "Lokalita",
  file_ref: "Podklady (soubory)",
};

// --- Stav session -----------------------------------------------------------

export const GUIDE_SESSION_STATES = [
  "active",
  "completed",
  "abandoned",
] as const;
export type GuideSessionState = (typeof GUIDE_SESSION_STATES)[number];

// --- Odpovědi ---------------------------------------------------------------

/**
 * „nevím" i „přeskočit" jsou VALIDNÍ odpovědi a nikdy neblokují postup
 * (zadani/16 §4). Rozlišujeme je od `answered`, protože do briefu (T020) vstupují
 * jako „chybějící podklad", ale krok je tím zodpovězený a engine jde dál.
 */
export const GUIDE_ANSWER_STATUSES = [
  "answered",
  "unknown",
  "skipped",
] as const;
export type GuideAnswerStatus = (typeof GUIDE_ANSWER_STATUSES)[number];

/** Hodnota lokality (§9.1). Přesná adresa je volitelná a soukromá. */
export interface GuideLocationValue {
  country?: string;
  region?: string;
  city?: string;
  municipality?: string;
  approximate?: string;
  /** Přesná adresa — sdílí se jen se souhlasem (`shareAddress`). */
  address?: string;
  shareAddress?: boolean;
}

/** Odkaz na nahrané podklady (§9.5) — id media assetů (T014). */
export interface GuideFileRefValue {
  mediaIds: string[];
}

/** Rozpětí (např. rozpočet). Aspoň jedna hranice je vyplněná. */
export interface GuideRangeValue {
  min: number | null;
  max: number | null;
}

/** Hodnota odpovědi podle typu otázky. Tvar validuje `validation.ts`. */
export type GuideAnswerValue =
  | string
  | number
  | string[]
  | GuideRangeValue
  | GuideLocationValue
  | GuideFileRefValue;

/**
 * Uložená odpověď na jeden krok. Uložení do `GuideSession.answers` je mapa
 * `klíč kroku → GuideAnswer`. `unknown`/`skipped` hodnotu nenesou.
 */
export type GuideAnswer =
  | { status: "answered"; value: GuideAnswerValue }
  | { status: "unknown" }
  | { status: "skipped" };

/** Mapa odpovědí session: klíč kroku → odpověď. */
export type GuideAnswers = Record<string, GuideAnswer>;

// --- Definice scénáře (data) ------------------------------------------------

/** Možnost pro single/multi-choice. */
export interface GuideStepOption {
  value: string;
  label: string;
  help?: string;
}

/** Konfigurace typu otázky (min/max, délka textu). Volitelné podle typu. */
export interface GuideStepConfig {
  /** number/range: dolní a horní mez hodnoty. */
  min?: number;
  max?: number;
  /** text: maximální délka. */
  maxLength?: number;
  /** multi_choice: minimální/maximální počet vybraných možností. */
  minSelected?: number;
  maxSelected?: number;
}

/**
 * Definice jednoho kroku (čistá data). `condition` je JSON DSL nad DŘÍVĚJŠÍMI
 * odpověďmi (viz `conditions.ts`); `undefined` = krok se zobrazí vždy.
 */
export interface GuideStepDefinition {
  key: string;
  type: GuideStepType;
  prompt: string;
  help?: string;
  options?: GuideStepOption[];
  config?: GuideStepConfig;
  condition?: GuideCondition;
  required?: boolean;
}

/** Pravidlo rozporu: pokud `when` platí nad odpověďmi, engine hlásí `message`. */
export interface GuideConflictRule {
  key: string;
  message: string;
  when: GuideCondition;
}

/**
 * Výstup koncové větve scénáře (T019). Mapuje odpovědi na DOPORUČENÍ: profese
 * (slugy z taxonomie T005), lidsky psaný další krok a podklady k přípravě.
 *
 * INVARIANT „žádná slepá ulička" (legacy-master-spec §53.1, zadani/16 §4): každá
 * průchozí koncová větev musí odpovídat aspoň jednomu výstupu (hlídá
 * `outcomes.ts#findUncoveredPaths`). Proto má scénář vždy záchranný výstup bez
 * `when` (uplatní se, když nesedne žádný specifičtější) — typicky odborná
 * konzultace/posouzení, nikdy vymyšlený závěr.
 *
 * Samotný render výstupu (souhrn, bezpečnostní varování) řeší T020; tady jsou jen
 * DATA. `safetyWarning` je proto jen flag (§15), ne hotová hláška.
 */
export interface GuideOutcome {
  /** Stabilní klíč koncové větve v rámci scénáře. */
  key: string;
  /** Kdy se výstup uplatní. `undefined` = vždy (záchranná síť proti slepé uličce). */
  when?: GuideCondition;
  /** Doporučené profese — slugy z taxonomie (T005), v pořadí priority. */
  professions: string[];
  /** Doporučený další krok (lidský text). */
  nextStep: string;
  /** Podklady, které si má uživatel připravit před oslovením profesionála. */
  prepare?: string[];
  /** Bezpečnostní upozornění (§15). Data pro render ve T020. */
  safetyWarning?: boolean;
  /** Krátké vysvětlení „proč" (zejména scénář H — „nevím, co potřebuji"). */
  note?: string;
}

/**
 * Kompletní definice scénáře. Pořadí `steps` = pořadí kroků (position). Engine
 * i seed pracují s tímto tvarem; service ho staví z DB řádků.
 */
export interface GuideScenarioDefinition {
  slug: string;
  version: number;
  name: string;
  steps: GuideStepDefinition[];
  conflicts?: GuideConflictRule[];
  /** Výstupy koncových větví (T019). Prázdné pole = scénář bez doporučení. */
  outcomes?: GuideOutcome[];
}

// --- Podmínkový DSL ---------------------------------------------------------
//
// Deklarativní výraz nad odpověďmi. Vyhodnocení je čistě serverové (conditions.ts).
// Odkaz na krok je vždy jeho `key`; validace (validation.ts) hlídá, že odkazuje
// jen na DŘÍVĚJŠÍ krok.

export type GuideCondition =
  | { op: "all"; conditions: GuideCondition[] }
  | { op: "any"; conditions: GuideCondition[] }
  | { op: "not"; condition: GuideCondition }
  | { op: "equals"; step: string; value: string | number | boolean }
  | { op: "in"; step: string; values: Array<string | number> }
  | { op: "includes"; step: string; value: string }
  | { op: "answered"; step: string }
  | { op: "unknown"; step: string }
  | { op: "skipped"; step: string }
  | { op: "exists"; step: string };

/** Operátory DSL, které se přímo vážou na jeden krok (`step`). */
export const GUIDE_LEAF_OPS = [
  "equals",
  "in",
  "includes",
  "answered",
  "unknown",
  "skipped",
  "exists",
] as const;

// --- Výstupy enginu ---------------------------------------------------------

export interface GuideProgress {
  /** Počet zodpovězených (i „nevím"/„přeskočit") viditelných kroků. */
  answered: number;
  /** Počet aktuálně viditelných kroků. */
  total: number;
  /** Poměr 0–1 (0, není-li žádný viditelný krok). */
  ratio: number;
  /** Jsou všechny viditelné kroky zodpovězené? */
  complete: boolean;
}

export interface GuideConflict {
  key: string;
  message: string;
}

/** Jedna položka shrnutí — viditelný krok s uloženou odpovědí. */
export interface GuideSummaryItem {
  key: string;
  prompt: string;
  type: GuideStepType;
  answer: GuideAnswer;
}

export interface GuideSummary {
  /** Viditelné kroky s uloženou odpovědí, v pořadí scénáře. */
  items: GuideSummaryItem[];
  /** Viditelné povinné kroky bez hodnotné odpovědi (chybějící podklady). */
  missing: Array<{ key: string; prompt: string }>;
  conflicts: GuideConflict[];
  /** Klíče odpovědí na krocích, které aktuálně nejsou na platné větvi. */
  staleAnswerKeys: string[];
  progress: GuideProgress;
}

// --- Závěrečný výsledek (T020) ----------------------------------------------
//
// Podklad pro souhrnnou obrazovku: rozřešené výstupy s NÁZVY profesí (slugy z dat
// se zde přeloží přes taxonomii T005), bezpečnostní upozornění (§15), rozpory a
// příznak „málo informací". Je to čistě PREZENTAČNÍ tvar — žádná logika navíc,
// žádné vymyšlené závěry (zadani/16 §4): render jen zobrazí, co engine rozhodl.

/** Doporučená profese rozřešená na název (+ kategorie) pro zobrazení. */
export interface GuideResolvedProfession {
  slug: string;
  name: string;
  categoryName?: string;
}

/** Jeden výstup koncové větve připravený k renderu v souhrnu. */
export interface GuideResultOutcome {
  key: string;
  /** Doporučené profese s názvy, v pořadí priority. */
  professions: GuideResolvedProfession[];
  /** Doporučený další krok + vysvětlení „proč" (lidský text). */
  nextStep: string;
  /** Podklady k přípravě před oslovením profesionála. */
  prepare: string[];
  /** Bezpečnostní upozornění (§15). */
  safetyWarning: boolean;
  /** Doplňující vysvětlení (zejména scénář H). */
  note?: string;
}

export interface GuideResult {
  /** Platné výstupy v pořadí priority (první = primární). */
  outcomes: GuideResultOutcome[];
  /** Podmnožina výstupů s bezpečnostním upozorněním (§15) — render napřed a výrazně. */
  safetyOutcomes: GuideResultOutcome[];
  /** Rozpory v odpovědích — jemné, NEBLOKUJÍCÍ upozornění (§8). */
  conflicts: GuideConflict[];
  /** Viditelné povinné kroky bez hodnotné odpovědi (chybějící podklady). */
  missing: Array<{ key: string; prompt: string }>;
  /**
   * Průvodce nezískal dost informací (samá „nevím"/„přeskočit"). Souhrn to pak
   * poctivě uvede a doporučí konzultaci, nikdy vymyšlený závěr (zadani/16 §4).
   */
  lowConfidence: boolean;
}
