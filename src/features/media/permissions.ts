/**
 * Oprávnění domény médií (T014). Registrují se přes `definePermission` při načtení
 * modulu (import v actions/queries/route), aby šly evaluovat přes `can()`. Modul
 * je čistý — jen rozhodovací logika nad `Actor` a předaným předmětem.
 *
 * Vlastník je polymorfní (uživatel NEBO organizace):
 *  - user-owned: nahrávat/mazat/vidět smí vlastník-uživatel; systémový admin též.
 *  - org-owned: nahrávat/mazat/spravovat smí org editor+ (matice T009). Konkrétní
 *    firemní roli zjistí datová vrstva a předá jako `isOrgEditor` / `isOrgMember`.
 *
 * Servírování (T014 § Permissions):
 *  - originál i libovolnou variantu vidí jen vlastník (user / člen org),
 *  - VEŘEJNĚ se vydá jen DERIVÁT assetu použitého v PUBLIKOVANÉM obsahu
 *    (`isPublicDerivative`) — rozhoduje serve route, tady jen kombinujeme fakta.
 */

import {
  type Actor,
  can,
  definePermission,
  hasRole,
  isPermissionDefined,
  isUser,
} from "@/lib/permissions";
import type { MediaOwnerRef } from "./rules";

/** Předmět pro upload: zamýšlený vlastník + firemní role actora (u org-owned). */
export type MediaUploadSubject = {
  owner: MediaOwnerRef;
  /** Je actor org editor+ ve vlastníkovské organizaci? (jen u org-owned). */
  isOrgEditor?: boolean;
};

/** Předmět pro správu (mazání, alt text) konkrétního assetu. */
export type MediaManageSubject = {
  owner: MediaOwnerRef;
  isOrgEditor?: boolean;
};

/** Předmět pro čtení/servírování assetu. */
export type MediaViewSubject = {
  owner: MediaOwnerRef;
  /** Je actor členem vlastníkovské organizace? (jen u org-owned). */
  isOrgMember?: boolean;
  /**
   * Je požadovaná varianta veřejně servírovatelný derivát assetu použitého
   * v publikovaném obsahu? Rozhoduje datová vrstva (usage + typ varianty).
   */
  isPublicDerivative?: boolean;
};

export const P_MEDIA_UPLOAD = "media.upload";
export const P_MEDIA_MANAGE = "media.manage";
export const P_MEDIA_VIEW = "media.view";

function isSystemAdmin(actor: Actor): boolean {
  return hasRole(actor, "admin");
}

/** Je actor vlastník (u user-owned) nebo org editor+ (u org-owned)? */
function isOwnerOrOrgEditor(
  actor: Actor,
  owner: MediaOwnerRef,
  isOrgEditor: boolean | undefined,
): boolean {
  if (owner.type === "user") {
    return isUser(actor) && actor.userId === owner.userId;
  }
  return isOrgEditor === true;
}

// Idempotentní registrace (HMR v dev může modul vyhodnotit víckrát).
if (!isPermissionDefined(P_MEDIA_UPLOAD)) {
  definePermission<MediaUploadSubject>(P_MEDIA_UPLOAD, (actor, subject) => {
    if (!isUser(actor)) return false;
    if (isSystemAdmin(actor)) return true;
    return isOwnerOrOrgEditor(actor, subject.owner, subject.isOrgEditor);
  });
}

if (!isPermissionDefined(P_MEDIA_MANAGE)) {
  definePermission<MediaManageSubject>(
    P_MEDIA_MANAGE,
    (actor, subject) =>
      isSystemAdmin(actor) ||
      isOwnerOrOrgEditor(actor, subject.owner, subject.isOrgEditor),
  );
}

if (!isPermissionDefined(P_MEDIA_VIEW)) {
  definePermission<MediaViewSubject>(P_MEDIA_VIEW, (actor, subject) => {
    // Veřejný derivát použitý v publikovaném obsahu — vidí kdokoli.
    if (subject.isPublicDerivative === true) return true;
    // Jinak jen vlastník / člen vlastníkovské firmy / admin.
    if (isSystemAdmin(actor)) return true;
    if (isOwnerOrOrgEditor(actor, subject.owner, undefined)) return true;
    return subject.owner.type === "organization" && subject.isOrgMember === true;
  });
}

/** Typovaný helper: smí actor nahrát asset pro daného vlastníka? */
export function canUploadMedia(
  actor: Actor,
  subject: MediaUploadSubject,
): boolean {
  return can(actor, P_MEDIA_UPLOAD, subject);
}

/** Typovaný helper: smí actor spravovat asset (mazat, alt text)? */
export function canManageMedia(
  actor: Actor,
  subject: MediaManageSubject,
): boolean {
  return can(actor, P_MEDIA_MANAGE, subject);
}

/** Typovaný helper: smí actor zobrazit/servírovat asset? */
export function canViewMedia(actor: Actor, subject: MediaViewSubject): boolean {
  return can(actor, P_MEDIA_VIEW, subject);
}
