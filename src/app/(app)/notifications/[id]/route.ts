import { notFound, redirect } from "next/navigation";
import { trackEvent } from "@/lib/analytics";
import { getActor } from "@/lib/session";
// Import zároveň registruje oprávnění notifikací (access_own).
import { canAccessNotification } from "@/features/notifications/permissions";
import {
  getNotificationForRecipient,
  markRead,
} from "@/features/notifications/service";

/**
 * „Otevření" notifikace (T032): jediná navigace, která notifikaci označí
 * přečtenou a přesměruje do jejího kontextu (`linkPath`). Server route (ne
 * klientská akce), aby označení nezáviselo na JS a nezávodilo s přesměrováním.
 *
 * Přístup má jen příjemce — cizí či neexistující ID vrací 404 (nerozlišujeme,
 * nepotvrzujeme existenci; T032 § Permissions). Cíl (`linkPath`) může mezitím
 * zmizet; o nedostupnost se postará cílová stránka (T032 § Alternative flows).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const actor = await getActor();
  if (actor.kind !== "user") redirect("/login");

  const notification = await getNotificationForRecipient(id, actor.userId);
  if (
    !notification ||
    !canAccessNotification(actor, {
      recipientUserId: notification.recipientUserId,
    })
  ) {
    notFound();
  }

  const changed = await markRead(notification.id, actor.userId);
  if (changed > 0) {
    trackEvent("notification.opened", { eventType: notification.eventType });
  }

  redirect(notification.linkPath || "/notifications");
}
