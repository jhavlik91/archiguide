/**
 * Sdílené typy a číselníky poptávky (T024).
 *
 * Hodnoty enumů zrcadlí `prisma/schema.prisma` (RequestType, RequestStatus,
 * RequestVisibility) — jsou jediným zdrojem pro Zod validaci (`validation.ts`),
 * stavový automat (`state-machine.ts`) i UI popisky. Modul je čistý (bez DB /
 * `next/*`), aby ho šlo použít i v klientských komponentách a plně pokrýt testy.
 */

import type { BriefContent } from "@/features/brief/types";

// --- Typ, viditelnost, stav -------------------------------------------------

export const REQUEST_TYPES = ["b2c", "b2b"] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];

export const REQUEST_VISIBILITIES = [
  "private",
  "shared_link",
  "public",
] as const;
export type RequestVisibility = (typeof REQUEST_VISIBILITIES)[number];

export const REQUEST_STATUSES = [
  "draft",
  "active",
  "in_discussion",
  "paused",
  "awarded",
  "closed",
  "cancelled",
  "expired",
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

/** Popisky typu pro UI (čeština). */
export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  b2c: "Soukromá (B2C)",
  b2b: "Firemní (B2B)",
};

/** Popisky stavů pro UI (čeština). Klíče pokrývají celý enum. */
export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  draft: "Rozpracovaná",
  active: "Aktivní",
  in_discussion: "V jednání",
  paused: "Pozastavená",
  awarded: "Zadaná",
  closed: "Uzavřená",
  cancelled: "Zrušená",
  expired: "Vypršelá",
};

export const REQUEST_VISIBILITY_LABELS: Record<RequestVisibility, string> = {
  private: "Soukromá",
  shared_link: "Sdílená odkazem",
  public: "Veřejná",
};

/**
 * Viditelnosti nabízené v UI selektoru (T025 § Main flow 1 — vlastník volí jen
 * mezi `private`/`public`). `shared_link` zůstává v enumu jako slot, ale
 * selektor ho zatím nenabízí.
 */
export const SELECTABLE_REQUEST_VISIBILITIES = ["private", "public"] as const;
export type SelectableRequestVisibility =
  (typeof SELECTABLE_REQUEST_VISIBILITIES)[number];

/** Max délka názvu poptávky (předvyplněný z briefu, editovatelný). */
export const REQUEST_TITLE_MAX_LENGTH = 160;
/** Max délka volných textových polí (rozpočet, časový horizont, region). */
export const REQUEST_FIELD_MAX_LENGTH = 500;

// --- Náhled poptávky pro UI -------------------------------------------------

/** Položka auditní historie přechodu (pro vlastníka / admina). */
export interface RequestAuditItem {
  id: string;
  action: string;
  fromStatus: RequestStatus | null;
  toStatus: RequestStatus;
  actorUserId: string | null;
  createdAt: string;
}

/** Kompletní náhled poptávky (řádek + snapshot briefu, je-li publikovaná). */
export interface RequestView {
  id: string;
  ownerUserId: string;
  briefId: string | null;
  type: RequestType;
  visibility: RequestVisibility;
  status: RequestStatus;
  title: string;
  targetProfessionSlugs: string[];
  region: string;
  budget: string | null;
  timeline: string | null;
  /** Termín (ISO), po jehož překročení `active` poptávka expiruje. */
  deadline: string | null;
  /** Snapshot obsahu briefu z okamžiku publikace (null do publikace). */
  briefSnapshot: BriefContent | null;
  publishedAt: string | null;
  editedAfterPublish: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Anonymizovaná projekce poptávky pro cizí čtenáře (T025, §20.2). WHITELIST DTO
 * — obsahuje jen pole, která smí vidět kdokoli (public) / pozvaní (private).
 * Záměrně BEZ `ownerUserId`, `briefId` a plného `briefSnapshot` (jen
 * redigovaný `briefPreview` bez přesné adresy) — nová soukromá pole na
 * `Request`/`BriefContent` se sem musí přidat explicitně, jinak se nezveřejní
 * (`features/requests/public-view.ts` § buildRequestPublicView).
 */
export interface RequestPublicView {
  id: string;
  type: RequestType;
  status: RequestStatus;
  title: string;
  targetProfessionSlugs: string[];
  region: string;
  budget: string | null;
  timeline: string | null;
  deadline: string | null;
  publishedAt: string | null;
  /** Redigovaný snapshot briefu (bez přesné adresy) — `null` do publikace. */
  briefPreview: BriefContent | null;
}

/** Stručná položka pro přehled mých poptávek (dashboard vlastníka). */
export interface RequestListItem {
  id: string;
  title: string;
  type: RequestType;
  status: RequestStatus;
  region: string;
  targetProfessionSlugs: string[];
  /** Počet reakcí — slot pro T027 (v MVP vždy 0). */
  responseCount: number;
  updatedAt: string;
}
