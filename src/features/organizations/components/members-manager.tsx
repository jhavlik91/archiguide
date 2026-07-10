"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserMinus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import {
  INVITABLE_ROLES,
  ORG_ROLES,
  ORG_ROLE_LABELS,
  type InvitableRole,
  type OrgRole,
} from "../types";
import { canAssignRole, canModifyMember } from "../rules";
import {
  changeMemberRoleAction,
  inviteMemberAction,
  leaveOrganizationAction,
  removeMemberAction,
} from "../actions";
import type { OrgActionResult } from "../actions";

export type MemberRow = { userId: string; email: string; role: OrgRole };
export type InvitationRow = {
  id: string;
  email: string;
  role: OrgRole;
  statusLabel: string;
  pending: boolean;
};

/**
 * Správa členů firmy (T009): změna role, odebrání, pozvání, přehled pozvánek a
 * vlastní odchod. Ovládací prvky jsou vidět jen s oprávněním (`canManage`);
 * server je stejně znovu ověří (obrana do hloubky). Invariant „min. 1 owner"
 * vynucuje server — UI jen zobrazí jeho chybu.
 */
export function MembersManager({
  orgId,
  members,
  invitations,
  viewerUserId,
  viewerRole,
  canManage,
}: {
  orgId: string;
  members: MemberRow[];
  invitations: InvitationRow[];
  viewerUserId: string;
  viewerRole: OrgRole | null;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<InvitableRole>("member");

  /** Spustí akci, ohlásí výsledek a při úspěchu překreslí. */
  function run(action: () => Promise<OrgActionResult>, success: string) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(success);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  /** Role, které smí prohlížející přiřadit (owner jen owner, jinak admin níž). */
  const assignableRoles = ORG_ROLES.filter(
    (r) => viewerRole !== null && canAssignRole(viewerRole, r),
  );

  return (
    <div className="space-y-6">
      {/* Pozvání člena */}
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pozvat člena</CardTitle>
            <CardDescription>
              Pošleme na e-mail odkaz s pozvánkou (platí 14 dní). Existující
              účet se připojí po přihlášení, nový po registraci.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="invite-email">E-mail</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="kolega@example.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invite-role">Role</Label>
                <Select
                  value={inviteRole}
                  onValueChange={(v) => setInviteRole(v as InvitableRole)}
                >
                  <SelectTrigger id="invite-role" className="sm:w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVITABLE_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ORG_ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                disabled={pending || inviteEmail.trim().length === 0}
                onClick={() =>
                  run(() => {
                    const email = inviteEmail;
                    const role = inviteRole;
                    setInviteEmail("");
                    return inviteMemberAction(orgId, { email, role });
                  }, "Pozvánka odeslána.")
                }
              >
                <UserPlus className="size-4" /> Pozvat
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Členové */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Členové ({members.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {members.map((m) => {
            const isSelf = m.userId === viewerUserId;
            const canModify =
              canManage &&
              !isSelf &&
              viewerRole !== null &&
              canModifyMember(viewerRole, m.role);
            return (
              <div
                key={m.userId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{m.email}</p>
                  {isSelf && (
                    <p className="text-muted-foreground text-xs">To jste vy</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {canModify ? (
                    <Select
                      value={m.role}
                      onValueChange={(v) =>
                        run(
                          () =>
                            changeMemberRoleAction(orgId, {
                              userId: m.userId,
                              role: v as OrgRole,
                            }),
                          "Role změněna.",
                        )
                      }
                    >
                      <SelectTrigger
                        className="h-8 w-36"
                        aria-label={`Role: ${m.email}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {/* Vždy nabídni i aktuální roli člena, i když ji sám neumím přiřadit. */}
                        {[...new Set([m.role, ...assignableRoles])].map((r) => (
                          <SelectItem key={r} value={r}>
                            {ORG_ROLE_LABELS[r]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="secondary">{ORG_ROLE_LABELS[m.role]}</Badge>
                  )}
                  {canModify && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Odebrat ${m.email}`}
                      disabled={pending}
                      onClick={() =>
                        run(
                          () => removeMemberAction(orgId, { userId: m.userId }),
                          "Člen odebrán.",
                        )
                      }
                    >
                      <UserMinus className="size-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Vlastní odchod */}
          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() =>
                run(
                  () => leaveOrganizationAction(orgId),
                  "Opustili jste firmu.",
                )
              }
            >
              Opustit firmu
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Pozvánky */}
      {canManage && invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pozvánky</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {invitations.map((inv) => (
              <div
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
              >
                <span className="truncate">{inv.email}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{ORG_ROLE_LABELS[inv.role]}</Badge>
                  <Badge variant={inv.pending ? "secondary" : "outline"}>
                    {inv.statusLabel}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
