/**
 * Sdílené typy a číselníky briefu (T021).
 *
 * Hodnoty enumů zrcadlí `prisma/schema.prisma` (BriefStatus, BriefVisibility) —
 * jsou jediným zdrojem pro Zod validaci (`content.ts`) i UI popisky. `BriefContent`
 * je SNAPSHOT všech povinných sekcí §18: brief drží vlastní kopii, takže smazání
 * zdrojové session ho neovlivní (zadani/09 — Brief).
 *
 * Modul je čistý (bez DB / `next/*`), aby ho šlo použít i v klientských
 * komponentách (náhled briefu) a plně pokrýt unit testy.
 */

// --- Stavy a viditelnost ----------------------------------------------------

export const BRIEF_STATUSES = [
  "draft",
  "ready",
  "shared",
  "revised",
  "archived",
] as const;
export type BriefStatus = (typeof BRIEF_STATUSES)[number];

export const BRIEF_VISIBILITIES = ["private", "shared_link", "public"] as const;
export type BriefVisibility = (typeof BRIEF_VISIBILITIES)[number];

/** Popisky stavů pro UI (čeština). Klíče pokrývají celý enum. */
export const BRIEF_STATUS_LABELS: Record<BriefStatus, string> = {
  draft: "Rozpracovaný",
  ready: "Připravený",
  shared: "Sdílený",
  revised: "Revidovaný",
  archived: "Archivovaný",
};

export const BRIEF_VISIBILITY_LABELS: Record<BriefVisibility, string> = {
  private: "Soukromý",
  shared_link: "Sdílený odkazem",
  public: "Veřejný",
};

/** Max délka automaticky navrženého názvu (§18 — editovatelný v T022). */
export const BRIEF_TITLE_MAX_LENGTH = 160;

// --- Obsah briefu (snapshot §18) --------------------------------------------

/** Doporučená profese S DŮVODEM doporučení (§18, převzato z T020). */
export interface BriefProfession {
  slug: string;
  name: string;
  /** Proč je profese doporučena (lidský text z výstupu guide). */
  reason: string;
}

/**
 * Lokalita v briefu (§18). `display` je veřejná část (město/region); `address`
 * je PŘESNÁ adresa držená jako SOUKROMÉ pole — nikdy se nepromítne do názvu ani
 * shrnutí (zadani/09 — Brief). `null`, není-li lokalita uvedena.
 */
export interface BriefLocation {
  /** Veřejně zobrazitelná lokalita (město/region), bez přesné adresy. */
  display: string;
  /** Přesná adresa — soukromá; sdílí se až později a jen se souhlasem. */
  address?: string;
  /** Dal uživatel souhlas s pozdějším sdílením přesné adresy? */
  shareAddress: boolean;
}

/**
 * Rozpočet v briefu (§18). `known: false` znamená „rozpočet neuveden" — nikdy se
 * nedopočítává vymyšlené číslo (zadani/16 §4, acceptance). `display` je vždy
 * vyplněno (buď částka/rozpětí, nebo „Rozpočet neuveden").
 */
export interface BriefBudget {
  known: boolean;
  /** Lidsky formátovaná hodnota, nebo „Rozpočet neuveden". */
  display: string;
  /** Čeho se rozpočet týká (projekt/realizace/…), je-li uvedeno. */
  scope?: string;
}

/** Volná dvojice „popisek → hodnota" pro preference a doplňkové odpovědi. */
export interface BriefDetail {
  /** Stabilní klíč kroku (kvůli editaci/dohledání). */
  key: string;
  label: string;
  value: string;
}

/** Dostupné podklady (§18) — odkaz na média z guide (T014). */
export interface BriefInputs {
  /** Počet přiložených podkladů. */
  count: number;
  /** Id media assetů (T014) — snapshot odkazů. */
  mediaIds: string[];
}

/**
 * Snapshot všech povinných částí briefu (§18). Pořadí polí = pořadí sekcí v
 * náhledu. Nevyplněné sekce jsou `null`/prázdné — render zobrazí „neuvedeno",
 * nikdy dopočítanou hodnotu.
 */
export interface BriefContent {
  /** Verze tvaru obsahu (kvůli budoucím migracím snapshotu). */
  version: 1;
  /** Shrnutí — lidský popis záměru, ne výpis odpovědí (§18). */
  summary: string;
  /** Cíl — čeho chce klient dosáhnout. */
  goal: string;
  /** Typ projektu (název scénáře). */
  projectType: string;
  /** Aktuální stav (vlastnický vztah, fáze). `null` = neuvedeno. */
  currentState: string | null;
  /** Rozsah záměru. `null` = neuvedeno. */
  scope: string | null;
  /** Lokalita. `null` = neuvedeno. */
  location: BriefLocation | null;
  /** Rozpočet (vždy vyplněno — i „neuveden"). */
  budget: BriefBudget;
  /** Časový horizont. `null` = neuvedeno. */
  timing: string | null;
  /** Dostupné podklady (§18). */
  inputs: BriefInputs;
  /** Chybějící podklady (§18) — povinné sekce bez hodnotné odpovědi. */
  missingInputs: string[];
  /** Preference a doplňkové odpovědi. */
  preferences: BriefDetail[];
  /** Rizika a nejasnosti (§18) — rozpory, „málo informací", bezpečnostní varování. */
  risks: string[];
  /** Doporučené profese S DŮVODEM (§18). */
  recommendedProfessions: BriefProfession[];
  /** Doporučený další krok (§18). `null`, nesedl-li žádný výstup. */
  nextStep: string | null;
}

/** Náhled briefu pro VLASTNÍKA (živý obsah + metadata sdílení). */
export interface BriefView {
  id: string;
  ownerUserId: string;
  guideSessionId: string | null;
  scenarioSlug: string;
  title: string;
  status: BriefStatus;
  visibility: BriefVisibility;
  /** Živý (editovatelný) obsah §18. */
  content: BriefContent;
  generatedAt: string;
  /** Token sdíleného odkazu (plaintext), nebo `null`, není-li aktivně sdíleno. */
  shareToken: string | null;
  /** Kdy vznikl aktuální sdílený snapshot (ISO), nebo `null`. */
  sharedAt: string | null;
  /** Kdy byl odkaz naposledy odvolán (ISO), nebo `null`. */
  shareRevokedAt: string | null;
  /**
   * Je sdílený snapshot STARŠÍ než živý obsah? (`status === "revised"` — vlastník
   * upravil brief po sdílení; příjemci zatím vidí starší verzi.)
   */
  hasUnsharedChanges: boolean;
}

/**
 * Read-only pohled na SDÍLENÝ brief pro příjemce odkazu (T022). Vychází ze
 * zmrazeného `sharedContent` snapshotu, má odstraněná soukromá pole
 * (`redactBriefPrivate`) a NEOBSAHUJE token ani identitu vlastníka.
 */
export interface SharedBriefView {
  title: string;
  content: BriefContent;
  scenarioSlug: string;
  sharedAt: string;
}
