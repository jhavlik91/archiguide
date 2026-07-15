"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, ShieldCheck, UserMinus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import type { UserStatus } from "@prisma/client";
import { ROLES, type Role } from "@/lib/permissions";
import {
  changeUserRoleAction,
  suspendUserAction,
  unsuspendUserAction,
} from "../actions";

const ROLE_LABELS: Record<Role, string> = {
  client: "Klient",
  professional: "Profesionál",
  moderator: "Moderátor",
  admin: "Admin",
};

type PendingAction =
  | { kind: "suspend" }
  | { kind: "unsuspend" }
  | { kind: "grant"; role: Role }
  | { kind: "revoke"; role: Role };

const DIALOG_COPY: Record<PendingAction["kind"], { title: string; description: string }> = {
  suspend: {
    title: "Zablokovat uživatele",
    description:
      "Uživatel se nebude moct přihlásit a jeho veřejný obsah zmizí. Uveďte důvod (auditní záznam).",
  },
  unsuspend: {
    title: "Odblokovat uživatele",
    description: "Uživatel se znovu bude moct přihlásit. Uveďte důvod (auditní záznam).",
  },
  grant: {
    title: "Přidělit roli",
    description: "Uveďte důvod přidělení role (auditní záznam).",
  },
  revoke: {
    title: "Odebrat roli",
    description: "Uveďte důvod odebrání role (auditní záznam).",
  },
};

/**
 * Admin akce nad uživatelem (T035 § Main flow 3): blokace/odblokování a
 * změna rolí. Každá akce vyžaduje důvod (dialog) a je znovu ověřená serverem
 * (`canManageUsers`) — tenhle panel se nezobrazí moderátorovi ani sobě.
 */
export function UserActionsPanel({
  userId,
  status,
  roles,
  isSelf,
}: {
  userId: string;
  status: UserStatus;
  roles: Role[];
  isSelf: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [action, setAction] = useState<PendingAction | null>(null);
  const [reason, setReason] = useState("");
  const [addRole, setAddRole] = useState<Role | "">("");

  const availableRoles = ROLES.filter((r) => !roles.includes(r));
  const isSuspended = status === "suspended";

  function close() {
    setAction(null);
    setReason("");
  }

  function confirm() {
    if (!action) return;
    const trimmedReason = reason.trim();
    if (trimmedReason.length < 3) {
      toast.error("Uveďte důvod (alespoň 3 znaky).");
      return;
    }
    startTransition(async () => {
      const result =
        action.kind === "suspend"
          ? await suspendUserAction(userId, { reason: trimmedReason })
          : action.kind === "unsuspend"
            ? await unsuspendUserAction(userId, { reason: trimmedReason })
            : await changeUserRoleAction(userId, {
                role: action.role,
                action: action.kind,
                reason: trimmedReason,
              });
      if (result.ok) {
        toast.success("Akce provedena.");
        close();
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  const copy = action ? DIALOG_COPY[action.kind] : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {isSuspended ? (
          <Button
            variant="secondary"
            onClick={() => setAction({ kind: "unsuspend" })}
          >
            <ShieldCheck className="size-4" /> Odblokovat
          </Button>
        ) : (
          <Button
            variant="destructive"
            disabled={isSelf}
            title={isSelf ? "Nemůžete zablokovat sám sebe." : undefined}
            onClick={() => setAction({ kind: "suspend" })}
          >
            <Ban className="size-4" /> Blokovat
          </Button>
        )}
      </div>

      <div className="space-y-2">
        <Label>Role</Label>
        <div className="flex flex-wrap items-center gap-2">
          {roles.map((r) => (
            <Badge key={r} variant="outline" className="gap-1 pr-1">
              {ROLE_LABELS[r]}
              <button
                type="button"
                aria-label={`Odebrat roli ${ROLE_LABELS[r]}`}
                className="hover:text-destructive ml-1"
                onClick={() => setAction({ kind: "revoke", role: r })}
              >
                <UserMinus className="size-3" />
              </button>
            </Badge>
          ))}
          {roles.length === 0 && (
            <span className="text-muted-foreground text-sm">Bez role.</span>
          )}
        </div>
        {availableRoles.length > 0 && (
          <div className="flex items-center gap-2 pt-1">
            <Select
              value={addRole}
              onValueChange={(v) => setAddRole(v as Role)}
            >
              <SelectTrigger className="w-40" aria-label="Přidat roli">
                <SelectValue placeholder="Přidat roli…" />
              </SelectTrigger>
              <SelectContent>
                {availableRoles.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              disabled={!addRole}
              onClick={() => {
                if (addRole) setAction({ kind: "grant", role: addRole });
              }}
            >
              <UserPlus className="size-4" /> Přidělit
            </Button>
          </div>
        )}
      </div>

      <Dialog open={action !== null} onOpenChange={(open) => !open && close()}>
        <DialogContent>
          {copy && (
            <DialogHeader>
              <DialogTitle>{copy.title}</DialogTitle>
              <DialogDescription>{copy.description}</DialogDescription>
            </DialogHeader>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="reason">Důvod</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Např. opakované porušení podmínek…"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close}>
              Zrušit
            </Button>
            <Button onClick={confirm} disabled={pending}>
              Potvrdit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
