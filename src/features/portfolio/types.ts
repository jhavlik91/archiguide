/**
 * Sdílené typy a číselníky portfolia (T012).
 *
 * Hodnoty enumů zrcadlí `prisma/schema.prisma` (PortfolioStatus, PortfolioVisibility,
 * PortfolioProjectType, PortfolioCoauthorStatus) — jsou jediným zdrojem pro Zod
 * validaci i UI popisky. Modul je čistý (bez DB / `next/*`), aby šel použít i v
 * klientských komponentách.
 */

export const TITLE_MAX_LENGTH = 160;
export const DESCRIPTION_MAX_LENGTH = 2000;
export const LOCATION_MAX_LENGTH = 120;

/**
 * Rozumný rozsah roku realizace (T012 § Validation). Spodní hranice je velkoryse
 * historická (rekonstrukce památek), horní připouští rozpracované/plánované dílo.
 */
export const YEAR_MIN = 1800;
export const YEAR_MAX_OFFSET = 5; // aktuální rok + 5 (plánované realizace)

export const PORTFOLIO_STATUSES = ["draft", "published", "archived"] as const;
export type PortfolioStatus = (typeof PORTFOLIO_STATUSES)[number];

export const PORTFOLIO_VISIBILITIES = ["public", "unlisted"] as const;
export type PortfolioVisibility = (typeof PORTFOLIO_VISIBILITIES)[number];

export const PORTFOLIO_PROJECT_TYPES = [
  "project",
  "realization",
  "concept",
  "technical_case_study",
  "craft_realization",
  "before_after",
  "competition",
  "research",
] as const;
export type PortfolioProjectType = (typeof PORTFOLIO_PROJECT_TYPES)[number];

export const PORTFOLIO_COAUTHOR_STATUSES = [
  "invited",
  "confirmed",
  "declined",
] as const;
export type PortfolioCoauthorStatus =
  (typeof PORTFOLIO_COAUTHOR_STATUSES)[number];

/** Vlastníkem díla je uživatel (profesionál) nebo organizace (polymorfní owner). */
export const PORTFOLIO_OWNER_TYPES = ["user", "organization"] as const;
export type PortfolioOwnerType = (typeof PORTFOLIO_OWNER_TYPES)[number];

/** Popisky stavů pro UI (čeština). Klíče pokrývají celý enum. */
export const PORTFOLIO_STATUS_LABELS: Record<PortfolioStatus, string> = {
  draft: "Koncept",
  published: "Publikováno",
  archived: "Archivováno",
};

export const PORTFOLIO_VISIBILITY_LABELS: Record<PortfolioVisibility, string> = {
  public: "Veřejné",
  unlisted: "Jen s odkazem",
};

export const PORTFOLIO_PROJECT_TYPE_LABELS: Record<
  PortfolioProjectType,
  string
> = {
  project: "Projekt",
  realization: "Realizace",
  concept: "Koncept / studie",
  technical_case_study: "Technická případová studie",
  craft_realization: "Řemeslná realizace",
  before_after: "Před / po",
  competition: "Soutěžní návrh",
  research: "Výzkumný projekt",
};

export const PORTFOLIO_COAUTHOR_STATUS_LABELS: Record<
  PortfolioCoauthorStatus,
  string
> = {
  invited: "Čeká na potvrzení",
  confirmed: "Potvrzeno",
  declined: "Odmítnuto",
};
