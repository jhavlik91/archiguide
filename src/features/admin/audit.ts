import "server-only";

import type { AdminAuditAction, AdminAuditTargetType, Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Centrální auditní log admin akcí (T035 § Main flow 3). Append-only — žádná
 * doména nesmí záznam editovat ani mazat. Jediné povolené místo pro zápis do
 * `db.adminAuditLog` (stejná konvence jako `lib/permissions.ts` pro `can()`).
 *
 * Cíl je polymorfní (`targetType` + `targetId`, bez FK) — kategorie/profese se
 * archivují, ne mažou (T005), takže cíl při čtení historie vždy existuje, ale
 * schéma na to nespoléhá. `reason` je u blokace/změny role povinný — vynucuje
 * to volající server action (Zod), ne tento modul.
 */

export type WriteAuditLogInput = {
  actorUserId: string;
  action: AdminAuditAction;
  targetType: AdminAuditTargetType;
  targetId: string;
  reason?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export async function writeAuditLog(input: WriteAuditLogInput): Promise<void> {
  await db.adminAuditLog.create({
    data: {
      actorUserId: input.actorUserId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason ?? null,
      metadata: input.metadata ?? {},
    },
  });
}

/** Historie admin akcí nad konkrétním cílem (nejnovější první). */
export async function listAuditLogFor(
  targetType: AdminAuditTargetType,
  targetId: string,
) {
  return db.adminAuditLog.findMany({
    where: { targetType, targetId },
    orderBy: { createdAt: "desc" },
    include: {
      actorUser: { select: { id: true, email: true } },
    },
  });
}
