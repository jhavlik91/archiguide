/**
 * Sdílené typy a číselníky organizací (T009).
 *
 * Hodnoty enumů zrcadlí `prisma/schema.prisma` (OrgStatus, OrgRole,
 * OrgInvitationStatus) — jsou jediným zdrojem pro Zod validaci i UI popisky.
 * Modul je čistý (bez DB / `next/*`), aby šel použít i v klientských komponentách.
 */

export const NAME_MAX_LENGTH = 120;
export const DESCRIPTION_MAX_LENGTH = 2000;

/** Doba platnosti pozvánky (T009 § Validation). */
export const INVITATION_TTL_DAYS = 14;

export const ORG_STATUSES = ["active", "archived"] as const;
export type OrgStatus = (typeof ORG_STATUSES)[number];

/**
 * Interní firemní role. Pořadí v poli = hierarchie (owner nejvyšší). Recruiter
 * a sales jsou post-MVP a schválně tu nejsou (viz T009 § Out of scope).
 */
export const ORG_ROLES = ["owner", "admin", "editor", "member"] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

/** Role, které lze přiřadit při pozvání (owner vzniká jen založením/předáním). */
export const INVITABLE_ROLES = ["admin", "editor", "member"] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

export const ORG_INVITATION_STATUSES = [
  "pending",
  "accepted",
  "declined",
  "expired",
] as const;
export type OrgInvitationStatus = (typeof ORG_INVITATION_STATUSES)[number];

/** Popisky rolí pro UI (čeština). Klíče pokrývají celý enum. */
export const ORG_ROLE_LABELS: Record<OrgRole, string> = {
  owner: "Vlastník",
  admin: "Administrátor",
  editor: "Editor",
  member: "Člen",
};

/** Krátký popis oprávnění role pro UI. */
export const ORG_ROLE_HINTS: Record<OrgRole, string> = {
  owner: "Vše včetně správy členů, předání vlastnictví a archivace.",
  admin: "Správa členů a editace firemního profilu.",
  editor: "Editace firemního profilu.",
  member: "Přístup k interním údajům firmy.",
};

export const ORG_INVITATION_STATUS_LABELS: Record<OrgInvitationStatus, string> =
  {
    pending: "Čeká na přijetí",
    accepted: "Přijato",
    declined: "Odmítnuto",
    expired: "Vypršelo",
  };
