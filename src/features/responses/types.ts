/**
 * Sdílené typy a číselníky reakce na poptávku (T027).
 *
 * Hodnoty enumů zrcadlí `prisma/schema.prisma` (RequestResponseStatus) — jsou
 * jediným zdrojem pro Zod validaci (`validation.ts`), stavový automat
 * (`state-machine.ts`) i UI popisky. Cenový model NEDUPLIKUJEME — sdílí enum s
 * `ProfessionalProfile.pricingModel` (T007, `@/features/profiles/types`).
 * Modul je čistý (bez DB / `next/*`), aby ho šlo použít i v klientských
 * komponentách.
 */

import type { PricingModel } from "@/features/profiles/types";

export const RESPONSE_STATUSES = [
  "draft",
  "sent",
  "viewed",
  "shortlisted",
  "accepted",
  "rejected",
  "withdrawn",
] as const;
export type ResponseStatus = (typeof RESPONSE_STATUSES)[number];

/** Popisky stavů pro UI (čeština). Klíče pokrývají celý enum. */
export const RESPONSE_STATUS_LABELS: Record<ResponseStatus, string> = {
  draft: "Rozpracovaná",
  sent: "Odeslaná",
  viewed: "Zobrazená",
  shortlisted: "Na užším seznamu",
  accepted: "Přijatá",
  rejected: "Odmítnutá",
  withdrawn: "Stažená",
};

/** Max délka zprávy a doplňujících textových polí (rozpočet, dostupnost). */
export const RESPONSE_MESSAGE_MAX_LENGTH = 4000;
export const RESPONSE_FIELD_MAX_LENGTH = 500;

/** Max počet přiložených portfolio projektů k jedné reakci. */
export const RESPONSE_MAX_PORTFOLIO_ITEMS = 6;

// --- Autor reakce (uživatel NEBO organizace) --------------------------------

export type ResponseAuthorRef =
  | { type: "user"; userId: string }
  | { type: "organization"; orgId: string };

/** Stručná informace o autorovi pro zobrazení (jméno/název dohledá volající). */
export interface ResponseAuthorSummary {
  ref: ResponseAuthorRef;
  displayName: string;
}

// --- Náhledy pro UI ----------------------------------------------------------

/** Přiložený portfolio projekt (náhled pro kartu reakce). */
export interface ResponsePortfolioItemView {
  id: string;
  title: string;
  slug: string | null;
}

/** Kompletní náhled reakce. */
export interface ResponseView {
  id: string;
  requestId: string;
  author: ResponseAuthorRef;
  status: ResponseStatus;
  message: string;
  priceModel: PricingModel | null;
  priceNote: string | null;
  availability: string | null;
  rejectionReason: string | null;
  viewedAt: string | null;
  portfolioItems: ResponsePortfolioItemView[];
  createdAt: string;
  updatedAt: string;
}

/** Řádek pro seznam vlastníka poptávky (karta: autor, zpráva, cena, portfolio). */
export interface ResponseListItemForOwner extends ResponseView {
  authorSummary: ResponseAuthorSummary;
}

/** Řádek pro dashboard „moje reakce" profesionála/firmy. */
export interface ResponseListItemForAuthor extends ResponseView {
  requestTitle: string;
  requestStatus: string;
}

/** Položka auditní historie přechodu (pro debug/vlastníka). */
export interface ResponseAuditItem {
  id: string;
  action: string;
  fromStatus: ResponseStatus | null;
  toStatus: ResponseStatus;
  actorUserId: string | null;
  createdAt: string;
}
