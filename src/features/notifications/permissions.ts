/**
 * Oprávnění notifikací (T032). Registrují se přes `definePermission` při načtení
 * modulu (side-effect import ve service/queries/actions), aby rozhodnutí o
 * přístupu šlo JEDINÝM místem (`lib/permissions.ts`) — konzumující kód nepíše
 * vlastní kontrolu (TECHNICKE-ZADANI §3.4).
 *
 * Pravidlo je striktní: uživatel vidí a spravuje VÝHRADNĚ své notifikace
 * (`recipientUserId === actor.userId`). Cizí notifikace nikdo (T032 § Permissions).
 */

import {
  type Actor,
  can,
  definePermission,
  isPermissionDefined,
  isUser,
} from "@/lib/permissions";

/** Předmět: kdo je příjemcem notifikace. */
export type NotificationSubject = {
  recipientUserId: string;
};

/** Číst a spravovat vlastní notifikaci (jen příjemce). */
export const P_NOTIFICATIONS_ACCESS = "notifications.access_own";

function actorIsRecipient(actor: Actor, subject: NotificationSubject): boolean {
  return isUser(actor) && actor.userId === subject.recipientUserId;
}

// Idempotentní registrace (HMR v dev může modul vyhodnotit víckrát).
if (!isPermissionDefined(P_NOTIFICATIONS_ACCESS)) {
  definePermission<NotificationSubject>(
    P_NOTIFICATIONS_ACCESS,
    actorIsRecipient,
  );
}

/** Typovaný helper: smí actor s notifikací nakládat (číst / označit přečtenou)? */
export function canAccessNotification(
  actor: Actor,
  subject: NotificationSubject,
): boolean {
  return can(actor, P_NOTIFICATIONS_ACCESS, subject);
}
