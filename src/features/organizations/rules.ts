/**
 * Čistá doménová pravidla organizací (T009). Bez DB a bez `next/*`, aby se dala
 * pokrýt unit testy a sdílet mezi service vrstvou, akcemi i UI.
 *
 * Dvě roviny pravidel:
 *  - invarianty stavu firmy (min. 1 owner, expirace pozvánky),
 *  - kompetence člena vůči jinému členovi (kdo koho smí měnit/odebrat).
 * Vlastní oprávnění vázaná na `Actor` (systémová role) žijí v `permissions.ts`.
 */

import { INVITATION_TTL_DAYS, type OrgRole } from "./types";

/** Hierarchie firemních rolí (vyšší číslo = víc pravomocí). */
export const ORG_ROLE_RANK: Record<OrgRole, number> = {
  owner: 3,
  admin: 2,
  editor: 1,
  member: 0,
};

/** Má role alespoň úroveň `min`? `null` (nečlen) nikdy. */
export function roleAtLeast(role: OrgRole | null, min: OrgRole): boolean {
  return role !== null && ORG_ROLE_RANK[role] >= ORG_ROLE_RANK[min];
}

/** Počet ownerů v seznamu rolí členů. */
export function ownerCount(roles: readonly OrgRole[]): number {
  return roles.filter((r) => r === "owner").length;
}

/**
 * Smí člen s `actorRole` přiřadit roli `newRole`?
 *  - owner může přiřadit cokoli (včetně předání vlastnictví),
 *  - admin může přiřadit admin/editor/member, ale ne owner (to je citlivá akce
 *    vyhrazená ownerovi — viz zadani/05 § Citlivé akce),
 *  - editor/member nesmí přiřazovat role.
 */
export function canAssignRole(actorRole: OrgRole, newRole: OrgRole): boolean {
  if (actorRole === "owner") return true;
  if (actorRole === "admin") return newRole !== "owner";
  return false;
}

/**
 * Smí člen s `actorRole` upravovat/odebírat člena s rolí `targetRole`?
 *  - owner smí na kohokoli,
 *  - admin smí na admin/editor/member, ale ne na ownera,
 *  - editor/member nesmí spravovat členy.
 */
export function canModifyMember(
  actorRole: OrgRole,
  targetRole: OrgRole,
): boolean {
  if (actorRole === "owner") return true;
  if (actorRole === "admin") return targetRole !== "owner";
  return false;
}

/**
 * Neporuší odebrání člena invariant „min. 1 owner"? Blokuje jen odebrání
 * posledního ownera. Ostatní role lze odebrat vždy.
 */
export function canRemoveMember(input: {
  targetRole: OrgRole;
  ownerCount: number;
}): boolean {
  if (input.targetRole !== "owner") return true;
  return input.ownerCount > 1;
}

/**
 * Neporuší změna role invariant „min. 1 owner"? Blokuje jen degradaci
 * posledního ownera (owner → něco jiného, když je jediný).
 */
export function canChangeRole(input: {
  currentRole: OrgRole;
  newRole: OrgRole;
  ownerCount: number;
}): boolean {
  if (input.currentRole === "owner" && input.newRole !== "owner") {
    return input.ownerCount > 1;
  }
  return true;
}

/** Smí člen odejít z firmy? Poslední owner nesmí (musí nejdřív předat vlastnictví). */
export function canLeave(input: {
  memberRole: OrgRole;
  ownerCount: number;
}): boolean {
  return canRemoveMember({
    targetRole: input.memberRole,
    ownerCount: input.ownerCount,
  });
}

/** Kdy pozvánka vytvořená v `from` vyprší (za 14 dní). */
export function invitationExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/** Je pozvánka po expiraci (bez ohledu na uložený stav)? */
export function isInvitationExpired(
  invitation: { expiresAt: Date },
  now: Date = new Date(),
): boolean {
  return invitation.expiresAt.getTime() <= now.getTime();
}

/**
 * Lze na pozvánku reagovat (přijmout/odmítnout)? Jen `pending`, která ještě
 * nevypršela. Vypršelá pending se chová jako `expired`, i když to v DB není.
 */
export function isInvitationActionable(
  invitation: { status: string; expiresAt: Date },
  now: Date = new Date(),
): boolean {
  return (
    invitation.status === "pending" && !isInvitationExpired(invitation, now)
  );
}

/**
 * Normalizuje IČO na porovnatelný tvar (jen číslice). Prázdné → `null`.
 * Slouží k detekci duplicit (warning, ne blok — viz T009 § Edge cases).
 */
export function normalizeBusinessId(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  return digits.length === 0 ? null : digits;
}
