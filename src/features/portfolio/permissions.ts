/**
 * Oprávnění domény portfolia (T012). Registrují se přes `definePermission` při
 * načtení modulu (import v actions/queries), takže jdou evaluovat přes `can()`.
 * Modul je čistý — žádná DB, jen rozhodovací logika nad `Actor` a předaným
 * předmětem (vlastník, stav, členství).
 *
 * Vlastník díla je polymorfní (uživatel NEBO organizace):
 *  - user-owned: editovat/mazat smí vlastník-uživatel; systémový admin též.
 *  - org-owned: editovat/mazat smí org editor+ (matice T009). Konkrétní firemní
 *    roli zjistí datová vrstva a předá jako `isOrgEditor` — engine do DB nesahá
 *    a nezávisí na (zatím nezmergeovaném) modulu organizací.
 *
 * Čtení (T012 § Permissions):
 *  - `published` je veřejné (i `unlisted` — jen se nelistuje),
 *  - `draft`/`archived` vidí jen editoři a pozvaní spoluautoři.
 */

import {
  type Actor,
  can,
  definePermission,
  hasRole,
  isPermissionDefined,
  isUser,
} from "@/lib/permissions";
import type { PortfolioStatus } from "./types";

/** Odkaz na vlastníka díla. */
export type PortfolioOwnerRef =
  | { type: "user"; userId: string }
  | { type: "organization"; orgId: string };

/**
 * Předmět oprávnění nad konkrétním dílem. Booleovské příznaky (`isOrgEditor`,
 * `isOrgMember`, `isInvitedCoauthor`) rozhoduje datová vrstva podle DB —
 * permission engine je jen kombinuje, aby zůstal čistý a nezávislý na doménách.
 */
export type PortfolioSubject = {
  owner: PortfolioOwnerRef;
  status: PortfolioStatus;
  /** Je actor org editor+ ve vlastníkovské organizaci? (jen u org-owned). */
  isOrgEditor?: boolean;
  /** Je actor členem vlastníkovské organizace? (čtení draftu u org-owned). */
  isOrgMember?: boolean;
  /** Má actor u díla řádek spoluautora (i `invited`)? (čtení draftu). */
  isInvitedCoauthor?: boolean;
};

/** Předmět pro založení díla: zamýšlený vlastník + role actora v org. */
export type PortfolioCreateSubject = {
  owner: PortfolioOwnerRef;
  isOrgEditor?: boolean;
};

export const P_PORTFOLIO_CREATE = "portfolio.create";
export const P_PORTFOLIO_EDIT = "portfolio.edit";
export const P_PORTFOLIO_DELETE = "portfolio.delete";
export const P_PORTFOLIO_VIEW = "portfolio.view";

/** Systémový admin má nad portfoliem dozor. */
function isSystemAdmin(actor: Actor): boolean {
  return hasRole(actor, "admin");
}

/** Je actor vlastníkem díla (u user-owned) nebo org editor+ (u org-owned)? */
function isEditor(actor: Actor, subject: PortfolioSubject): boolean {
  if (subject.owner.type === "user") {
    return isUser(actor) && actor.userId === subject.owner.userId;
  }
  return subject.isOrgEditor === true;
}

// Idempotentní registrace (HMR v dev může modul vyhodnotit víckrát).
if (!isPermissionDefined(P_PORTFOLIO_CREATE)) {
  definePermission<PortfolioCreateSubject>(
    P_PORTFOLIO_CREATE,
    (actor, subject) => {
      if (isSystemAdmin(actor)) return true;
      if (subject.owner.type === "user") {
        // Vlastní portfolio zakládá profesionál pro svůj účet.
        return (
          isUser(actor) &&
          actor.userId === subject.owner.userId &&
          hasRole(actor, "professional")
        );
      }
      // Firemní portfolio zakládá org editor+.
      return subject.isOrgEditor === true;
    },
  );
}

if (!isPermissionDefined(P_PORTFOLIO_EDIT)) {
  definePermission<PortfolioSubject>(
    P_PORTFOLIO_EDIT,
    (actor, subject) => isSystemAdmin(actor) || isEditor(actor, subject),
  );
}

if (!isPermissionDefined(P_PORTFOLIO_DELETE)) {
  definePermission<PortfolioSubject>(
    P_PORTFOLIO_DELETE,
    (actor, subject) => isSystemAdmin(actor) || isEditor(actor, subject),
  );
}

if (!isPermissionDefined(P_PORTFOLIO_VIEW)) {
  definePermission<PortfolioSubject>(P_PORTFOLIO_VIEW, (actor, subject) => {
    // Publikované dílo je veřejné (unlisted se jen nelistuje, čtení je povolené).
    if (subject.status === "published") return true;
    // Draft/archiv: jen editoři, členové vlastníkovské firmy a pozvaní spoluautoři.
    if (isSystemAdmin(actor)) return true;
    if (isEditor(actor, subject)) return true;
    if (subject.owner.type === "organization" && subject.isOrgMember === true) {
      return true;
    }
    return subject.isInvitedCoauthor === true;
  });
}

/** Typovaný helper: smí actor založit dílo pro daného vlastníka? */
export function canCreatePortfolio(
  actor: Actor,
  subject: PortfolioCreateSubject,
): boolean {
  return can(actor, P_PORTFOLIO_CREATE, subject);
}

/** Typovaný helper: smí actor editovat dílo? */
export function canEditPortfolio(
  actor: Actor,
  subject: PortfolioSubject,
): boolean {
  return can(actor, P_PORTFOLIO_EDIT, subject);
}

/** Typovaný helper: smí actor smazat dílo? */
export function canDeletePortfolio(
  actor: Actor,
  subject: PortfolioSubject,
): boolean {
  return can(actor, P_PORTFOLIO_DELETE, subject);
}

/** Typovaný helper: smí actor zobrazit dílo? */
export function canViewPortfolio(
  actor: Actor,
  subject: PortfolioSubject,
): boolean {
  return can(actor, P_PORTFOLIO_VIEW, subject);
}
