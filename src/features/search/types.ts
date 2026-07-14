/**
 * Sdílené typy a číselníky vyhledávání profesionálů (T034). Čistý modul (bez DB
 * a `next/*`), aby ho mohla použít jak service vrstva, tak klientské UI filtrů.
 */

/** Kolik výsledků na stránku (cursor stránkování). */
export const PAGE_SIZE = 12;

/** Řazení výsledků. `relevance` bez dotazu degraduje na `newest`. */
export const SORT_OPTIONS = ["relevance", "newest"] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export const SORT_LABELS: Record<SortOption, string> = {
  relevance: "Relevance",
  newest: "Nejnovější",
};

/**
 * Normalizovaný stav vyhledávání odvozený z URL (sdílitelný, SEO). Prázdné
 * filtry jsou `null`, neznámé hodnoty se zahazují už při parsování (§ Validation).
 */
export type SearchState = {
  /** Surový (ořezaný) fulltextový dotaz — prázdný řetězec = bez dotazu. */
  query: string;
  /** Slug profese z taxonomie (T005), nebo `null`. */
  profession: string | null;
  /** Region / lokalita (volný text proti `location` + `serviceAreas`). */
  region: string | null;
  /** Specializace (volný text proti `specializations`). */
  specialization: string | null;
  /** Jen ověřené účty (badge z T011). */
  verifiedOnly: boolean;
  sort: SortOption;
  /** Neprůhledný kurzor pro další stránku, nebo `null` (první stránka). */
  cursor: string | null;
};

/** Ověřovací badge zobrazený na kartě — přesně říká, CO bylo ověřeno (T011 §3). */
export type CardBadge = "phone" | "email";

/** Jedna profese na kartě výsledku. */
export type CardProfession = {
  slug: string;
  name: string;
  isPrimary: boolean;
};

/** Karta profilu ve výsledcích vyhledávání (jen veřejná, ne-privátní pole). */
export type ProfessionalCard = {
  slug: string;
  headline: string;
  /** Hlavní + vedlejší profese (pro popisek „profese"). */
  professions: CardProfession[];
  location: string | null;
  region: string | null;
  bioSnippet: string | null;
  /** Náhledový obrázek prvního publikovaného projektu, nebo `null`. */
  portfolioCoverUrl: string | null;
  publishedProjectCount: number;
  /** Ověřovací badge (např. „Ověřený telefon"). */
  badges: CardBadge[];
};

/** Výsledek jednoho vyhledávání pro stránku. */
export type SearchResult = {
  cards: ProfessionalCard[];
  /** Celkový počet shod (pro `search_performed` a hlavičku výsledků). */
  total: number;
  /** Kurzor další stránky, nebo `null` když už další není. */
  nextCursor: string | null;
};
