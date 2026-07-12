/**
 * Čistá doménová pravidla attachment systému (T023). Bez DB / `next/*` / storage,
 * aby šla pokrýt unit testy a sdílet mezi service, akcemi, routami i UI.
 *
 * Těžiště: rozhodnutí o přístupu (viditelnost × role × účastnictví v kontextu) a
 * detekce zpřístupňující změny u citlivé přílohy (vyžaduje explicitní potvrzení).
 */

import { type Actor, isUser } from "@/lib/permissions";
import { type AttachmentVisibility, VISIBILITY_RANK } from "./types";

/** Polymorfní odkaz na kontext přílohy (typ domény + ID entity v ní). */
export type AttachmentContext = {
  /** Typ domény, např. `brief`, `request`, `response`, `message`. */
  type: string;
  /** ID entity v dané doméně. */
  id: string;
};

/** Fakta o přístupu, která zná datová vrstva a předává je čistému rozhodnutí. */
export type AccessFacts = {
  /** Vlastník přílohy (nahravatel). */
  ownerUserId: string;
  visibility: AttachmentVisibility;
  /**
   * Je actor účastníkem kontextu přílohy? Vyhodnocuje resolver registrovaný
   * doménou (viz registry.ts). Relevantní jen pro `shared_in_context`.
   */
  isParticipant: boolean;
};

/**
 * Smí actor přílohu vidět/stáhnout? Čisté rozhodnutí nad už zjištěnými fakty:
 *  - vlastník: vždy (i u `private`),
 *  - `public`: kdokoli (i návštěvník),
 *  - `shared_in_context`: jen účastník daného kontextu,
 *  - `private`: nikdo kromě vlastníka.
 *
 * Záměrně BEZ plošného admin overridu — příloha může nést citlivá osobní data a
 * matice (zadani/05) admina do cizích soukromých příloh nepouští (least privilege).
 */
export function decideAccess(actor: Actor, facts: AccessFacts): boolean {
  if (isUser(actor) && actor.userId === facts.ownerUserId) return true;
  switch (facts.visibility) {
    case "public":
      return true;
    case "shared_in_context":
      return facts.isParticipant;
    case "private":
      return false;
  }
}

/**
 * Zpřístupňuje změna viditelnosti přílohu (posun k otevřenější hodnotě)?
 * Zpřísnění ani beze změny nezpřístupňuje.
 */
export function isMoreOpen(
  next: AttachmentVisibility,
  current: AttachmentVisibility,
): boolean {
  return VISIBILITY_RANK[next] > VISIBILITY_RANK[current];
}

/**
 * Vyžaduje změna viditelnosti explicitní potvrzení? Ano právě tehdy, když je
 * příloha `sensitive` a změna ji zpřístupňuje širšímu okruhu (zadani/12 §8 —
 * varování před zveřejněním dokumentu s osobními údaji). Zpřísnění potvrzení
 * nevyžaduje.
 */
export function requiresSensitiveConfirmation(
  current: AttachmentVisibility,
  next: AttachmentVisibility,
  sensitive: boolean,
): boolean {
  return sensitive && isMoreOpen(next, current);
}
