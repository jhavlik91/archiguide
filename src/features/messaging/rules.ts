/**
 * Čistá doménová pravidla messaging systému (T030). Bez DB / `next/*`, aby šla
 * pokrýt unit testy a sdílet mezi service, akcemi, čtecí vrstvou i UI.
 *
 * Těžiště: účastnictví v konverzaci, deterministický klíč pro znovupoužití,
 * výpočet nepřečtených, blokace odeslání vůči zrušenému/deaktivovanému účtu a
 * sestavení zobrazované identity.
 */

import { type ConversationContext, type ParticipantIdentity } from "./types";

/** Je uživatel účastníkem konverzace (jeho ID je v seznamu účastníků)? */
export function isParticipant(
  participantUserIds: readonly string[],
  userId: string,
): boolean {
  return participantUserIds.includes(userId);
}

/**
 * Deterministický klíč konverzace pro znovupoužití (T030 § Main flow bod 2).
 * Stejná dvojice účastníků ve stejném kontextu → stejný klíč → tatáž konverzace.
 * Seřazení ID účastníků zajistí nezávislost na pořadí (A→B == B→A).
 */
export function buildDedupeKey(
  context: ConversationContext | null,
  participantUserIds: readonly string[],
): string {
  const ctxType = context?.type ?? "direct";
  const ctxId = context?.id ?? "";
  const sorted = [...participantUserIds].sort().join("~");
  return `${ctxType}:${ctxId}:${sorted}`;
}

/** Zpráva pro výpočet nepřečtených (minimum, které pravidlo potřebuje). */
export type UnreadMessage = {
  senderUserId: string;
  createdAt: Date;
  moderationState: string;
};

/**
 * Kolik zpráv je pro diváka nepřečtených? Počítají se jen viditelné zprávy OD
 * NĚKOHO JINÉHO, novější než divákův `lastReadAt` (NULL = ještě nečetl → vše).
 * Vlastní zprávy ani skryté (T036) se nepočítají.
 */
export function countUnread(
  messages: readonly UnreadMessage[],
  viewerUserId: string,
  lastReadAt: Date | null,
): number {
  return messages.reduce((count, m) => {
    if (m.senderUserId === viewerUserId) return count;
    if (m.moderationState !== "visible") return count;
    if (lastReadAt && m.createdAt <= lastReadAt) return count;
    return count + 1;
  }, 0);
}

/** Stav účtu, který blokuje příjem zpráv (protistrana není dostupná). */
const UNAVAILABLE_STATUSES = new Set(["deactivated", "deleted"]);

/**
 * Smí divák do konverzace psát vůči protistranám s danými stavy účtu? Odeslání
 * se zablokuje, pokud je kterákoli protistrana deaktivovaná nebo zrušená —
 * historie zůstává čitelná, ale nová zpráva by neměla komu dojít (T030 §
 * Alternative flows). Vrací důvod pro UI, nebo `null` když lze psát.
 */
export function sendBlockReason(
  otherParticipantStatuses: readonly string[],
): string | null {
  const blocked = otherParticipantStatuses.some((s) =>
    UNAVAILABLE_STATUSES.has(s),
  );
  if (!blocked) return null;
  return "Druhý účastník má zrušený nebo deaktivovaný účet, novou zprávu teď nelze odeslat.";
}

/** Lokální část e-mailu (před `@`) jako fallback handle bez odhalení domény. */
export function emailLocalPart(email: string): string {
  const at = email.indexOf("@");
  return at > 0 ? email.slice(0, at) : email;
}

/** Fakta o uživateli, ze kterých se skládá zobrazovaná identita. */
export type IdentityFacts = {
  userId: string;
  /** `UserStatus` z DB (`active` | `deactivated` | `deleted`). */
  status: string;
  email: string;
  /** Titulek profesního profilu (T007), je-li vyplněný. */
  headline: string | null;
  /** Slug veřejného profilu (T008), je-li publikovaný. */
  slug: string | null;
};

/**
 * Sestaví zobrazovanou identitu účastníka (T030 § Edge cases). Zrušený účet →
 * placeholder „Zrušený účet" bez odkazu; jinak titulek profilu, případně handle
 * z e-mailu. Odkaz na veřejný profil jen když má publikovaný slug.
 */
export function buildIdentity(facts: IdentityFacts): ParticipantIdentity {
  if (facts.status === "deleted") {
    return {
      userId: facts.userId,
      label: "Zrušený účet",
      href: null,
      deleted: true,
    };
  }
  const headline = facts.headline?.trim();
  const label = headline && headline.length > 0
    ? headline
    : emailLocalPart(facts.email);
  return {
    userId: facts.userId,
    label,
    href: facts.slug ? `/profesional/${facts.slug}` : null,
    deleted: false,
  };
}
