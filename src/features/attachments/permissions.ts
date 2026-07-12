/**
 * Oprávnění attachment systému (T023). Registrují se přes `definePermission` při
 * načtení modulu (side-effect import v service/actions/route), aby šly evaluovat
 * přes `can()` — veškeré rozhodování o přístupu tak jde JEDNÍM místem
 * (`lib/permissions.ts`), konzumující tasky nepíší vlastní logiku (T023 § Main flow).
 *
 * Modul je čistý — jen rozhodovací logika nad `Actor` a předanými fakty. Zjištění
 * účastnictví v kontextu (`isParticipant`) i vlastníka řeší datová vrstva a předá
 * je jako subject.
 */

import {
  type Actor,
  can,
  definePermission,
  isPermissionDefined,
  isUser,
} from "@/lib/permissions";
import { decideAccess, type AccessFacts } from "./rules";

/** Předmět pro čtení/stažení přílohy (viditelnost + účastnictví + vlastník). */
export type AttachmentAccessSubject = AccessFacts;

/** Předmět pro správu přílohy (mazání, změna viditelnosti) — jen vlastník. */
export type AttachmentManageSubject = {
  ownerUserId: string;
};

export const P_ATTACHMENT_ACCESS = "attachment.access";
export const P_ATTACHMENT_MANAGE = "attachment.manage";

// Idempotentní registrace (HMR v dev může modul vyhodnotit víckrát).
if (!isPermissionDefined(P_ATTACHMENT_ACCESS)) {
  definePermission<AttachmentAccessSubject>(
    P_ATTACHMENT_ACCESS,
    (actor, subject) => decideAccess(actor, subject),
  );
}

if (!isPermissionDefined(P_ATTACHMENT_MANAGE)) {
  definePermission<AttachmentManageSubject>(
    P_ATTACHMENT_MANAGE,
    (actor, subject) => isUser(actor) && actor.userId === subject.ownerUserId,
  );
}

/** Typovaný helper: smí actor přílohu vidět/stáhnout? */
export function canAccessAttachment(
  actor: Actor,
  subject: AttachmentAccessSubject,
): boolean {
  return can(actor, P_ATTACHMENT_ACCESS, subject);
}

/** Typovaný helper: smí actor přílohu spravovat (mazat, měnit viditelnost)? */
export function canManageAttachment(
  actor: Actor,
  subject: AttachmentManageSubject,
): boolean {
  return can(actor, P_ATTACHMENT_MANAGE, subject);
}
