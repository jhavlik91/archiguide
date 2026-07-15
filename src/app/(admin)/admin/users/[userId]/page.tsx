import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getActor } from "@/lib/session";
import { can } from "@/lib/permissions";
import {
  P_ADMIN_MANAGE_USERS,
  P_ADMIN_VIEW_USERS,
} from "@/features/admin/permissions";
import { getUserDetailForAdmin } from "@/features/admin/users/queries";
import { UserActionsPanel } from "@/features/admin/users/components/user-actions-panel";

const STATUS_LABELS: Record<string, string> = {
  active: "Aktivní",
  deactivated: "Deaktivovaný",
  suspended: "Blokovaný",
  deleted: "Smazaný",
};

const ROLE_LABELS: Record<string, string> = {
  client: "Klient",
  professional: "Profesionál",
  moderator: "Moderátor",
  admin: "Admin",
};

const AUDIT_ACTION_LABELS: Record<string, string> = {
  user_suspended: "Zablokován",
  user_unsuspended: "Odblokován",
  user_role_granted: "Přidělena role",
  user_role_revoked: "Odebrána role",
};

/** Detail uživatele pro admin (T035 § Main flow 2): účet, role, profily, firmy. */
export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const actor = await getActor();
  if (!can(actor, P_ADMIN_VIEW_USERS)) forbidden();

  const { userId } = await params;
  const detail = await getUserDetailForAdmin(userId);
  if (!detail) notFound();

  const canManage = can(actor, P_ADMIN_MANAGE_USERS);
  const isSelf = actor.kind === "user" && actor.userId === userId;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/admin/users"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Zpět na výpis
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {detail.professionalProfile?.headline || detail.email}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">{detail.email}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Účet</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">Stav</p>
            <Badge
              variant={
                detail.status === "active"
                  ? "success"
                  : detail.status === "suspended"
                    ? "destructive"
                    : "secondary"
              }
            >
              {STATUS_LABELS[detail.status] ?? detail.status}
            </Badge>
          </div>
          <div>
            <p className="text-muted-foreground">Registrace</p>
            <p>{detail.createdAt.toLocaleDateString("cs-CZ")}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Poslední aktivita</p>
            <p>
              {detail.lastLoginAt
                ? detail.lastLoginAt.toLocaleString("cs-CZ")
                : "Ještě se nepřihlásil(a)"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Jazyk</p>
            <p>{detail.locale}</p>
          </div>
        </CardContent>
      </Card>

      {canManage && !isSelf && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Akce</CardTitle>
          </CardHeader>
          <CardContent>
            <UserActionsPanel
              userId={detail.id}
              status={detail.status}
              roles={detail.roles}
              isSelf={isSelf}
            />
          </CardContent>
        </Card>
      )}
      {canManage && isSelf && (
        <p className="text-muted-foreground text-sm">
          Toto je váš vlastní účet — admin akce nad sebou samým nejsou dostupné.
        </p>
      )}
      {!canManage && (
        <div className="flex flex-wrap gap-2">
          {detail.roles.map((r) => (
            <Badge key={r} variant="outline">
              {ROLE_LABELS[r] ?? r}
            </Badge>
          ))}
        </div>
      )}

      {(detail.professionalProfile || detail.organizations.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profily a firmy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {detail.professionalProfile && (
              <p>
                Profesní profil:{" "}
                <span className="text-muted-foreground">
                  {detail.professionalProfile.status === "published"
                    ? "publikovaný"
                    : "koncept"}
                </span>
              </p>
            )}
            {detail.organizations.map((org) => (
              <p key={org.id}>
                {org.name} —{" "}
                <span className="text-muted-foreground">{org.role}</span>
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      {detail.verifications.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ověření</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {detail.verifications.map((v) => (
              <Badge
                key={v.type}
                variant={v.status === "verified" ? "success" : "secondary"}
              >
                {v.type}: {v.status}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      {detail.auditLog.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historie admin akcí</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {detail.auditLog.map((entry) => (
              <div key={entry.id} className="border-b pb-2 last:border-0">
                <p>
                  <span className="font-medium">
                    {AUDIT_ACTION_LABELS[entry.action] ?? entry.action}
                  </span>{" "}
                  <span className="text-muted-foreground">
                    {entry.createdAt.toLocaleString("cs-CZ")} —{" "}
                    {entry.actorEmail ?? "neznámý admin"}
                  </span>
                </p>
                {entry.reason && (
                  <p className="text-muted-foreground italic">
                    „{entry.reason}“
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
