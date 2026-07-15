/**
 * Oprávnění messaging systému (T030). Registrují se přes `definePermission` při
 * načtení modulu (side-effect import v service/queries/actions), aby veškeré
 * rozhodování o přístupu šlo JEDNÍM místem (`lib/permissions.ts`) — konzumující
 * kód nepíše vlastní kontrolu rolí (TECHNICKE-ZADANI §3.4, T030 § Permissions).
 *
 * Pravidlo je striktní: číst i psát smí VÝHRADNĚ účastníci konverzace. Žádný
 * jiný uživatel ani role (matice zadani/05 — cizí zprávy nikdo; moderátor/admin
 * jen podmíněně přes reporty, což řeší T036, ne přímý přístup). Návštěvník nikdy.
 */

import {
  type Actor,
  can,
  definePermission,
  isPermissionDefined,
  isUser,
} from "@/lib/permissions";
import { isParticipant } from "./rules";

/** Předmět pro čtení i psaní: kdo jsou účastníci konverzace. */
export type ConversationSubject = {
  participantUserIds: readonly string[];
};

/** Číst konverzaci a její zprávy (jen účastník). */
export const P_MESSAGING_ACCESS = "messaging.access_conversation";
/** Odeslat zprávu do konverzace (jen účastník; dostupnost protistrany řeší akce). */
export const P_MESSAGING_SEND = "messaging.send_message";
/** Zahájit konverzaci (kterýkoli přihlášený uživatel; návštěvník ne). */
export const P_MESSAGING_START = "messaging.start_conversation";
/** Nahlásit zprávu / zablokovat protistranu (jen účastník konverzace) — T031. */
export const P_MESSAGING_REPORT = "messaging.report_message";
export const P_MESSAGING_BLOCK = "messaging.block_participant";

function actorIsParticipant(actor: Actor, subject: ConversationSubject): boolean {
  return isUser(actor) && isParticipant(subject.participantUserIds, actor.userId);
}

// Idempotentní registrace (HMR v dev může modul vyhodnotit víckrát).
if (!isPermissionDefined(P_MESSAGING_ACCESS)) {
  definePermission<ConversationSubject>(P_MESSAGING_ACCESS, actorIsParticipant);
}
if (!isPermissionDefined(P_MESSAGING_SEND)) {
  definePermission<ConversationSubject>(P_MESSAGING_SEND, actorIsParticipant);
}
if (!isPermissionDefined(P_MESSAGING_START)) {
  definePermission(P_MESSAGING_START, (actor) => isUser(actor));
}
// Nahlásit i zablokovat smí jen účastník konverzace (matice — číst cizí zprávy:
// nikdo; report zpřístupní moderátorovi obsah až přes T036, ne přímý přístup).
if (!isPermissionDefined(P_MESSAGING_REPORT)) {
  definePermission<ConversationSubject>(P_MESSAGING_REPORT, actorIsParticipant);
}
if (!isPermissionDefined(P_MESSAGING_BLOCK)) {
  definePermission<ConversationSubject>(P_MESSAGING_BLOCK, actorIsParticipant);
}

/** Typovaný helper: smí actor konverzaci číst? */
export function canAccessConversation(
  actor: Actor,
  subject: ConversationSubject,
): boolean {
  return can(actor, P_MESSAGING_ACCESS, subject);
}

/** Typovaný helper: smí actor do konverzace psát (účastnictví; ne dostupnost)? */
export function canSendToConversation(
  actor: Actor,
  subject: ConversationSubject,
): boolean {
  return can(actor, P_MESSAGING_SEND, subject);
}

/** Typovaný helper: smí actor zahájit konverzaci? */
export function canStartConversation(actor: Actor): boolean {
  return can(actor, P_MESSAGING_START);
}

/** Typovaný helper: smí actor nahlásit zprávu v konverzaci (účastnictví)? */
export function canReportInConversation(
  actor: Actor,
  subject: ConversationSubject,
): boolean {
  return can(actor, P_MESSAGING_REPORT, subject);
}

/** Typovaný helper: smí actor (od)blokovat protistranu konverzace (účastnictví)? */
export function canBlockInConversation(
  actor: Actor,
  subject: ConversationSubject,
): boolean {
  return can(actor, P_MESSAGING_BLOCK, subject);
}
