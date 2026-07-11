import "server-only";

import { cache } from "react";
import { db } from "@/lib/db";
import { getActor } from "@/lib/session";
import { canViewInternal } from "./permissions";
import { isOrgPubliclyVisible } from "./public-view";
import { isInvitationActionable } from "./rules";
import {
  getInvitationByTokenHash,
  getMembershipRole,
  getOrganizationDetail,
  getPublicOrganizationBySlug,
  listOrganizationsForUser,
  type OrganizationDetail,
  type OrganizationListItem,
} from "./service";
import { hashInvitationToken } from "./tokens";
import type { OrgRole } from "./types";

/**
 * Čtecí vrstva organizací (T009) pro stránky. Vynucuje viditelnost interních dat:
 * detail firmy vidí jen její člen (nebo systémový admin). Veřejná stránka firmy
 * přijde v T010 — tady jde čistě o interní správu.
 */

/** Firmy, jichž je přihlášený uživatel členem. Návštěvník → prázdný seznam. */
export async function listMyOrganizations(): Promise<OrganizationListItem[]> {
  const actor = await getActor();
  if (actor.kind !== "user") return [];
  return listOrganizationsForUser(actor.userId);
}

export type ViewableOrganization = {
  organization: OrganizationDetail;
  /** Role aktuálního actora ve firmě (`null` u systémového admina-nečlena). */
  viewerRole: OrgRole | null;
};

/**
 * Detail firmy pro aktuálního actora. Vrátí `null`, pokud firma neexistuje nebo
 * na její interní data actor nemá právo (není člen a není systémový admin).
 */
export async function getViewableOrganization(
  orgId: string,
): Promise<ViewableOrganization | null> {
  const actor = await getActor();
  if (actor.kind !== "user") return null;

  const [organization, viewerRole] = await Promise.all([
    getOrganizationDetail(orgId),
    getMembershipRole(orgId, actor.userId),
  ]);
  if (!organization) return null;
  if (!canViewInternal(actor, { orgRole: viewerRole })) return null;

  return { organization, viewerRole };
}

// --- Veřejná stránka firmy (T010) -------------------------------------------

/** Člen týmu pro veřejnou stránku — bez jakýchkoli kontaktních údajů. */
export type PublicTeamMember = {
  /** Zobrazované jméno: titulek veřejného profilu, jinak neutrální fallback. */
  name: string;
  /** Odkaz na veřejný profil profesionála (T008), nebo `null` (nemá publikovaný). */
  href: string | null;
  photoUrl: string | null;
  role: OrgRole;
};

/** Data pro vykreslení veřejné firemní stránky. */
export type PublicOrganizationView = {
  id: string;
  name: string;
  logoUrl: string | null;
  description: string | null;
  location: string | null;
  serviceAreas: string[];
  specializations: string[];
  contact: {
    email: string | null;
    phone: string | null;
    website: string | null;
  };
  team: PublicTeamMember[];
};

/**
 * Načte veřejnou firmu podle slugu a připraví ji k vykreslení (T010). Vrací
 * `null`, když firma neexistuje nebo je archivovaná (→ route dá 404). Do týmu
 * jde jen člen s opt-inem (`publicVisible`); jeho jméno/odkaz se bere z veřejného
 * profilu (T008) — kontaktní údaje členů se nikdy nezveřejňují.
 *
 * Memoizováno per-request (`cache`), aby `generateMetadata`, OG obrázek i render
 * sáhly na DB jen jednou.
 */
export const getPublicOrganization = cache(
  async (slug: string): Promise<PublicOrganizationView | null> => {
    const org = await getPublicOrganizationBySlug(slug);
    if (!org || !isOrgPubliclyVisible(org.status)) return null;

    const team: PublicTeamMember[] = org.members.map((m) => {
      const profile = m.user.professionalProfile;
      // Titulek/foto a odkaz bereme jen z publikovaného profilu (draft je privátní).
      const published = profile?.status === "published" && !!profile.slug;
      return {
        name: (published && profile?.headline?.trim()) || "Člen týmu",
        href: published ? `/profesional/${profile!.slug}` : null,
        photoUrl: published ? (profile?.photoUrl ?? null) : null,
        role: m.role,
      };
    });

    return {
      id: org.id,
      name: org.name,
      logoUrl: org.logoUrl,
      description: org.description,
      location: org.location,
      serviceAreas: org.serviceAreas,
      specializations: org.specializations,
      contact: {
        email: org.publicEmail,
        phone: org.publicPhone,
        website: org.publicWebsite,
      },
      team,
    };
  },
);

export type InvitationView = {
  token: string;
  orgName: string;
  email: string;
  role: OrgRole;
  actionable: boolean;
  status: string;
  /** Odpovídá pozvánka e-mailu přihlášeného účtu? */
  emailMatchesViewer: boolean;
};

/**
 * Pozvánka podle plaintext tokenu z odkazu pro zobrazení na stránce přijetí.
 * Vrací i `emailMatchesViewer`, aby stránka mohla poradit správný účet
 * (existující se připojí, neexistující projde registrací a pak se připojí).
 */
export async function getInvitationView(
  token: string,
): Promise<InvitationView | null> {
  const invitation = await getInvitationByTokenHash(hashInvitationToken(token));
  if (!invitation) return null;

  const actor = await getActor();
  let emailMatchesViewer = false;
  if (actor.kind === "user") {
    const user = await db.user.findUnique({
      where: { id: actor.userId },
      select: { email: true },
    });
    emailMatchesViewer =
      user?.email.toLowerCase() === invitation.email.toLowerCase();
  }

  return {
    token,
    orgName: invitation.org.name,
    email: invitation.email,
    role: invitation.role,
    actionable: isInvitationActionable(invitation),
    status: invitation.status,
    emailMatchesViewer,
  };
}
