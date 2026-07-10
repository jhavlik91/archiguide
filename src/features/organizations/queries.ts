import "server-only";

import { db } from "@/lib/db";
import { getActor } from "@/lib/session";
import { canViewInternal } from "./permissions";
import { isInvitationActionable } from "./rules";
import {
  getInvitationByTokenHash,
  getMembershipRole,
  getOrganizationDetail,
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
