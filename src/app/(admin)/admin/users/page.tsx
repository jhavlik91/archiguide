import Link from "next/link";
import { forbidden } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getActor } from "@/lib/session";
import { P_ADMIN_VIEW_USERS } from "@/features/admin/permissions";
import { can } from "@/lib/permissions";
import {
  PAGE_SIZE,
  listUsersForAdmin,
  type AdminUserRow,
} from "@/features/admin/users/queries";
import { userListFilterSchema } from "@/features/admin/users/validation";

/**
 * Výpis uživatelů (T035 § Main flow 2) — vyhledání jménem/e-mailem a filtry
 * (role, stav, ověření). Moderátor vidí jen read-only výpis (akce jsou na
 * detailu uživatele a kontrolují oprávnění tam znovu).
 */

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

function statusVariant(status: string): "success" | "warning" | "destructive" | "secondary" {
  if (status === "active") return "success";
  if (status === "suspended") return "destructive";
  if (status === "deactivated") return "warning";
  return "secondary";
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function buildQuery(
  filter: Record<string, string | number>,
  overrides: Record<string, string | number>,
): string {
  const merged = { ...filter, ...overrides };
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value !== "" && value !== "all" && value !== undefined) {
      params.set(key, String(value));
    }
  }
  return params.toString();
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const actor = await getActor();
  if (!can(actor, P_ADMIN_VIEW_USERS)) forbidden();

  const raw = await searchParams;
  const filter = userListFilterSchema.parse({
    query: typeof raw.query === "string" ? raw.query : undefined,
    role: typeof raw.role === "string" ? raw.role : undefined,
    status: typeof raw.status === "string" ? raw.status : undefined,
    verified: typeof raw.verified === "string" ? raw.verified : undefined,
    page: typeof raw.page === "string" ? raw.page : undefined,
  });

  const { rows, total, pageCount } = await listUsersForAdmin(filter);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Uživatelé</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {total} uživatel(ů) celkem.
        </p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1 space-y-1.5">
          <label htmlFor="query" className="text-sm font-medium">
            Jméno nebo e-mail
          </label>
          <input
            id="query"
            name="query"
            type="text"
            defaultValue={filter.query ?? ""}
            className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="role" className="text-sm font-medium">
            Role
          </label>
          <select
            id="role"
            name="role"
            defaultValue={filter.role}
            className="border-input bg-background h-10 rounded-md border px-3 text-sm"
          >
            <option value="all">Všechny</option>
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="status" className="text-sm font-medium">
            Stav
          </label>
          <select
            id="status"
            name="status"
            defaultValue={filter.status}
            className="border-input bg-background h-10 rounded-md border px-3 text-sm"
          >
            <option value="all">Všechny</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="verified" className="text-sm font-medium">
            Ověření
          </label>
          <select
            id="verified"
            name="verified"
            defaultValue={filter.verified}
            className="border-input bg-background h-10 rounded-md border px-3 text-sm"
          >
            <option value="all">Všichni</option>
            <option value="yes">Ověření</option>
            <option value="no">Neověření</option>
          </select>
        </div>
        <Button type="submit">Filtrovat</Button>
      </form>

      <div className="divide-y rounded-lg border">
        {rows.length === 0 ? (
          <p className="text-muted-foreground p-6 text-sm">
            Žádný uživatel neodpovídá filtru.
          </p>
        ) : (
          rows.map((row: AdminUserRow) => (
            <Link
              key={row.id}
              href={`/admin/users/${row.id}`}
              className="hover:bg-muted/50 flex flex-wrap items-center justify-between gap-3 p-4 transition-colors"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {row.professionalHeadline || row.email}
                </p>
                <p className="text-muted-foreground truncate text-xs">
                  {row.email}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {row.roles.map((r) => (
                  <Badge key={r} variant="outline">
                    {ROLE_LABELS[r] ?? r}
                  </Badge>
                ))}
                <Badge variant={statusVariant(row.status)}>
                  {STATUS_LABELS[row.status] ?? row.status}
                </Badge>
              </div>
            </Link>
          ))
        )}
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/admin/users?${buildQuery(filter, { page: p })}`}
              className={
                p === filter.page
                  ? "bg-primary text-primary-foreground rounded-md px-3 py-1 text-sm"
                  : "hover:bg-muted rounded-md px-3 py-1 text-sm"
              }
            >
              {p}
            </Link>
          ))}
        </div>
      )}

      <p className="text-muted-foreground text-xs">
        Stránka {filter.page} z {pageCount} ({PAGE_SIZE} na stránku).
      </p>
    </div>
  );
}
