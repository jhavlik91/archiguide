import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { requireUser } from "@/lib/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  canEditOrg,
  canManageMembers,
} from "@/features/organizations/permissions";
import { getViewableOrganization } from "@/features/organizations/queries";
import {
  isInvitationActionable,
  isInvitationExpired,
} from "@/features/organizations/rules";
import {
  ORG_INVITATION_STATUS_LABELS,
  type OrgInvitationStatus,
} from "@/features/organizations/types";
import { OrganizationProfileEditor } from "@/features/organizations/components/organization-profile-editor";
import {
  MembersManager,
  type InvitationRow,
  type MemberRow,
} from "@/features/organizations/components/members-manager";

/** Odvodí zobrazovaný stav pozvánky (pending po expiraci = vypršelo). */
function invitationStatusLabel(inv: {
  status: OrgInvitationStatus;
  expiresAt: Date;
}): string {
  if (inv.status === "pending" && isInvitationExpired(inv)) {
    return ORG_INVITATION_STATUS_LABELS.expired;
  }
  return ORG_INVITATION_STATUS_LABELS[inv.status];
}

export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const actor = await requireUser();
  const data = await getViewableOrganization(orgId);
  if (!data) notFound();

  const { organization: org, viewerRole } = data;
  const subject = { orgRole: viewerRole };
  const canEdit = canEditOrg(actor, subject);
  const canManage = canManageMembers(actor, subject);

  const members: MemberRow[] = org.members.map((m) => ({
    userId: m.userId,
    email: m.user.email,
    role: m.role,
    publicVisible: m.publicVisible,
  }));

  const invitations: InvitationRow[] = org.invitations.map((inv) => ({
    id: inv.id,
    email: inv.email,
    role: inv.role,
    statusLabel: invitationStatusLabel(inv),
    pending: isInvitationActionable(inv),
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/organizations"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" /> Zpět na firmy
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{org.name}</h1>
          {org.status === "archived" && (
            <Badge variant="outline">Archivováno</Badge>
          )}
          {org.status === "active" && org.slug && (
            <Button variant="ghost" size="sm" asChild className="ml-auto">
              <Link href={`/firma/${org.slug}`}>
                <ExternalLink className="size-4" /> Veřejná stránka
              </Link>
            </Button>
          )}
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Firemní profil</h2>
        <OrganizationProfileEditor
          orgId={org.id}
          canEdit={canEdit}
          profile={{
            name: org.name,
            logoUrl: org.logoUrl,
            description: org.description,
            businessId: org.businessId,
            location: org.location,
            serviceAreas: org.serviceAreas,
            specializations: org.specializations,
            publicEmail: org.publicEmail,
            publicPhone: org.publicPhone,
            publicWebsite: org.publicWebsite,
          }}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Tým</h2>
        <MembersManager
          orgId={org.id}
          members={members}
          invitations={invitations}
          viewerUserId={actor.userId}
          viewerRole={viewerRole}
          canManage={canManage}
        />
      </section>
    </div>
  );
}
