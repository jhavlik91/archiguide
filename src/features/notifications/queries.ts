import "server-only";

import type { Notification } from "@prisma/client";
import { getActor } from "@/lib/session";
// Import zároveň registruje oprávnění notifikací.
import "./permissions";
import { countUnread, listNotifications } from "./service";
import {
  NOTIFICATION_BELL_LIMIT,
  type NotificationCentre,
  type NotificationView,
} from "./types";

/**
 * Čtecí vrstva notifikací (T032) pro layout a stránku. Vrací jen notifikace
 * PŘIHLÁŠENÉHO diváka (per-uživatel filtr v service) — cizí se nikdy nenačtou.
 */

/** Sestaví serializovatelný pohled na notifikaci (cíl = uložená `linkPath`). */
function toView(n: Notification): NotificationView {
  return {
    id: n.id,
    eventType: n.eventType,
    title: n.title,
    reason: n.reason,
    href: n.linkPath,
    priority: n.priority,
    unread: n.state === "unread",
    count: n.count,
    lastEventAt: n.lastEventAt.toISOString(),
  };
}

/**
 * Data pro notifikační centrum (zvoneček): počet nepřečtených + posledních N
 * notifikací. Návštěvník dostane prázdné centrum (zvoneček se stejně renderuje jen
 * v chráněném layoutu).
 */
export async function getNotificationCentre(): Promise<NotificationCentre> {
  const actor = await getActor();
  if (actor.kind !== "user") return { unreadCount: 0, items: [] };

  const [unreadCount, rows] = await Promise.all([
    countUnread(actor.userId),
    listNotifications(actor.userId, NOTIFICATION_BELL_LIMIT),
  ]);
  return { unreadCount, items: rows.map(toView) };
}

/** Kompletní seznam notifikací diváka pro stránku `/notifications`. */
export async function getAllNotifications(
  limit = 100,
): Promise<NotificationView[]> {
  const actor = await getActor();
  if (actor.kind !== "user") return [];
  const rows = await listNotifications(actor.userId, limit);
  return rows.map(toView);
}
