import "server-only";

import { db } from "@/lib/db";
import type { Role } from "@/lib/permissions";

/**
 * Datová vrstva rolí (T004). Jediné místo, které smí sahat na `db.userRole`
 * (viz ESLint pravidlo `no-restricted-syntax`). Vynucení oprávnění (kdo smí
 * roli přidělit) je v `actions.ts`, ne tady.
 */

/** Role uživatele. */
export async function listRoles(userId: string): Promise<Role[]> {
  const rows = await db.userRole.findMany({
    where: { userId },
    select: { role: true },
  });
  return rows.map((r) => r.role as Role);
}

/**
 * Přidělí roli. Idempotentní — opakované volání nevytvoří duplicitu (unikát
 * `userId+role`). `grantedBy` je admin, který roli udělil (null = self-service).
 */
export async function grantRole(
  userId: string,
  role: Role,
  grantedBy: string | null = null,
): Promise<void> {
  await db.userRole.upsert({
    where: { userId_role: { userId, role } },
    create: { userId, role, grantedBy },
    update: {},
  });
}

/** Odebere roli. Idempotentní — chybějící role není chyba. */
export async function revokeRole(userId: string, role: Role): Promise<void> {
  await db.userRole.deleteMany({ where: { userId, role } });
}
