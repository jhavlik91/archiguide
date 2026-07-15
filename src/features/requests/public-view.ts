/**
 * Whitelist projekce poptávky pro cizí čtenáře (T025, zadani/legacy-master-spec.md
 * §20.2–20.3). Čistá vrstva (bez DB) — JEDINÉ místo, které sestavuje
 * anonymizovanou verzi poptávky. Žádné „vezmi celý řádek a smaž pár polí" —
 * `buildRequestPublicView` pole explicitně VYBÍRÁ (`RequestPublicSource`), takže
 * přidání soukromého pole na `Request` samo o sobě nic nezveřejní (§ Validation
 * — „veřejná projekce definovaná whitelist DTO, žádné `select *`").
 */

import { redactBriefPrivate } from "@/features/brief/content";
import type { BriefContent } from "@/features/brief/types";
import type {
  RequestPublicView,
  RequestStatus,
  RequestType,
  RequestVisibility,
} from "./types";

/** Pořadí otevřenosti viditelnosti (jako `AttachmentVisibility` v T023). */
export const REQUEST_VISIBILITY_RANK: Record<RequestVisibility, number> = {
  private: 0,
  shared_link: 1,
  public: 2,
};

/**
 * Posouvá změna viditelnosti poptávku k ŠIRŠÍMU okruhu čtenářů? Jen takový
 * přechod vyžaduje sanitizační potvrzení (main flow bod 4) — zpřísnění
 * (`public → private`) je vždy bez varování.
 */
export function isMoreOpenVisibility(
  next: RequestVisibility,
  current: RequestVisibility,
): boolean {
  return REQUEST_VISIBILITY_RANK[next] > REQUEST_VISIBILITY_RANK[current];
}

/** Zdrojová data pro sestavení veřejné projekce — podmnožina `RequestView`. */
export interface RequestPublicSource {
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
}

/**
 * Sestaví anonymizovanou projekci. `ownerUserId` a plný `briefSnapshot` sem
 * vůbec nevstupují (typ zdroje je nemá) a brief prochází `redactBriefPrivate`
 * (odstraní přesnou adresu) — stejná redakce jako u sdíleného briefu v T022.
 */
export function buildRequestPublicView(
  source: RequestPublicSource,
  briefContent: BriefContent | null,
): RequestPublicView {
  return {
    id: source.id,
    type: source.type,
    status: source.status,
    title: source.title,
    targetProfessionSlugs: source.targetProfessionSlugs,
    region: source.region,
    budget: source.budget,
    timeline: source.timeline,
    deadline: source.deadline,
    publishedAt: source.publishedAt,
    briefPreview: briefContent ? redactBriefPrivate(briefContent) : null,
  };
}
