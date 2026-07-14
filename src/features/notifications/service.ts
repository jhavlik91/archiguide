import "server-only";

import type { Notification } from "@prisma/client";
import { db } from "@/lib/db";
import { higherPriority } from "./rules";
import {
  NOTIFICATION_BELL_LIMIT,
  NOTIFICATION_PRIORITIES,
  type NotificationPreferences,
  type NotificationPriority,
} from "./types";

/**
 * Datová vrstva notifikací (T032). Jediné místo, které sahá na `db.notification`.
 * Drží invariant deduplikace: dokud je notifikace NEPŘEČTENÁ, opakovaný emit se
 * stejným `dedupeKey` jen zvýší `count` a `lastEventAt` (žádný duplikát); po
 * přečtení vznikne nová. Oprávnění (kdo smí akci provést) řeší emit/actions/queries
 * přes permission vrstvu — tady se jen filtruje na `recipientUserId`.
 */

export type CreateNotificationInput = {
  recipientUserId: string;
  eventType: string;
  priority: NotificationPriority;
  title: string;
  reason: string;
  linkPath: string;
  context: { type: string; id: string } | null;
  dedupeKey: string;
};

/**
 * Vloží notifikaci, nebo — existuje-li NEPŘEČTENÁ se stejným `(recipient, dedupeKey)`
 * — jen ji „bumpne": zvýší počet, obnoví `lastEventAt` (vrátí ji nahoru v centru) a
 * případně zvýší prioritu (nikdy nesníží). `created` odliší novou notifikaci od
 * sloučené (pro analytiku `notification.created` a UI). Sekvenční emity (zprávy v
 * konverzaci vznikají po jedné) tím spolehlivě sloučí do jediné položky s počtem.
 */
export async function createOrBumpNotification(
  input: CreateNotificationInput,
): Promise<{ notification: Notification; created: boolean }> {
  const existing = await db.notification.findFirst({
    where: {
      recipientUserId: input.recipientUserId,
      dedupeKey: input.dedupeKey,
      state: "unread",
    },
  });

  if (existing) {
    const notification = await db.notification.update({
      where: { id: existing.id },
      data: {
        count: { increment: 1 },
        lastEventAt: new Date(),
        priority: higherPriority(
          existing.priority,
          NOTIFICATION_PRIORITIES,
          input.priority,
        ),
        // Titulek/odkaz obnovíme na nejnovější (kontext se mohl posunout).
        title: input.title,
        reason: input.reason,
        linkPath: input.linkPath,
      },
    });
    return { notification, created: false };
  }

  const notification = await db.notification.create({
    data: {
      recipientUserId: input.recipientUserId,
      eventType: input.eventType,
      priority: input.priority,
      title: input.title,
      reason: input.reason,
      linkPath: input.linkPath,
      contextType: input.context?.type ?? null,
      contextId: input.context?.id ?? null,
      dedupeKey: input.dedupeKey,
    },
  });
  return { notification, created: true };
}

/** Posledních N notifikací příjemce pro centrum (nejnovější událost nahoře). */
export function listNotifications(
  recipientUserId: string,
  limit: number = NOTIFICATION_BELL_LIMIT,
): Promise<Notification[]> {
  return db.notification.findMany({
    where: { recipientUserId },
    orderBy: { lastEventAt: "desc" },
    take: limit,
  });
}

/** Počet nepřečtených notifikací příjemce (badge na zvonečku). */
export function countUnread(recipientUserId: string): Promise<number> {
  return db.notification.count({
    where: { recipientUserId, state: "unread" },
  });
}

/**
 * Notifikace podle ID, jen patří-li danému příjemci (jinak `null`). Cizí a
 * neexistující nerozlišujeme navenek — obojí skončí `null` (T032 § Permissions).
 */
export function getNotificationForRecipient(
  id: string,
  recipientUserId: string,
): Promise<Notification | null> {
  return db.notification.findFirst({
    where: { id, recipientUserId },
  });
}

/**
 * Označí jednu notifikaci příjemce jako přečtenou. Filtr na `recipientUserId`
 * zajistí, že cizí notifikaci nikdo neoznačí. Vrací počet dotčených řádků (0 =
 * neexistuje / cizí / už přečtená).
 */
export async function markRead(
  id: string,
  recipientUserId: string,
): Promise<number> {
  const { count } = await db.notification.updateMany({
    where: { id, recipientUserId, state: "unread" },
    data: { state: "read", readAt: new Date() },
  });
  return count;
}

/** Označí všechny nepřečtené notifikace příjemce jako přečtené. Vrací počet. */
export async function markAllRead(recipientUserId: string): Promise<number> {
  const { count } = await db.notification.updateMany({
    where: { recipientUserId, state: "unread" },
    data: { state: "read", readAt: new Date() },
  });
  return count;
}

/**
 * Notifikační preference příjemce z `User.notificationPreferences` (JSON). Chybí-li
 * uživatel nebo je hodnota prázdná, vrací prázdné preference (default politika).
 */
export async function getNotificationPreferences(
  recipientUserId: string,
): Promise<NotificationPreferences> {
  const user = await db.user.findUnique({
    where: { id: recipientUserId },
    select: { notificationPreferences: true },
  });
  const raw = user?.notificationPreferences;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as NotificationPreferences;
  }
  return {};
}

/** Existuje aktivní příjemce? (nedoručujeme zrušenému/neexistujícímu účtu). */
export async function recipientIsDeliverable(
  recipientUserId: string,
): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: recipientUserId },
    select: { status: true },
  });
  return user !== null && user.status !== "deleted";
}
