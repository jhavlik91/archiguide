import "server-only";

import { headers } from "next/headers";
import { Prisma, type Notification } from "@prisma/client";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/transport";
import { trackEvent } from "@/lib/analytics";
import { getVerifiedTypes } from "@/features/verification/service";
import { eventGroup } from "./rules";
import { renderNotificationEmail } from "./email-template";
import { createUnsubscribeToken } from "./unsubscribe-token";

/**
 * E-mailový dispatcher pro JEDNU nově vzniklou notifikaci (T033 § Main flow bod 1).
 * Voláno z `emit.ts` až PO úspěšném založení in-app notifikace — nikdy na
 * dedup-bump (aby 5 zpráv v konverzaci neposlalo 5 e-mailů). Best-effort:
 * NIKDY nevyhodí; selhání se zaznamená do `NotificationEmailDelivery` a
 * zaloguje, in-app notifikace už existuje bez ohledu na výsledek (T033 §
 * Acceptance — "selhání e-mail providera neshodí vytvoření in-app notifikace").
 */

async function getBaseUrl(): Promise<string> {
  if (process.env.AUTH_URL) return process.env.AUTH_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

function isPrismaError(error: unknown, code: "P2002"): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
  );
}

export async function dispatchNotificationEmail(
  notification: Notification,
): Promise<void> {
  try {
    const group = eventGroup(notification.eventType);
    if (!group) return; // Neznámý typ (obranně — emit už validoval proti katalogu).

    const [user, verifiedTypes] = await Promise.all([
      db.user.findUnique({
        where: { id: notification.recipientUserId },
        select: { email: true },
      }),
      getVerifiedTypes(notification.recipientUserId),
    ]);
    // Jen na ověřený e-mail (T033 § Edge cases; T011). Neověřený/změněný e-mail → ticho.
    if (!user || !verifiedTypes.includes("email")) return;

    // Rezervace řádku PŘED odesláním — unikátní `notificationId` zaručí nejvýš
    // jeden pokus na notifikaci i při souběžném volání (P2002 = jiný proces vyhrál).
    let deliveryId: string;
    try {
      const delivery = await db.notificationEmailDelivery.create({
        data: {
          recipientUserId: notification.recipientUserId,
          notificationId: notification.id,
          kind: "transactional",
          status: "queued",
        },
      });
      deliveryId = delivery.id;
    } catch (error) {
      if (isPrismaError(error, "P2002")) return; // Už odesláno/probíhá jinde.
      throw error;
    }

    const baseUrl = await getBaseUrl();
    const ctaUrl = `${baseUrl}${notification.linkPath}`;
    const content = renderNotificationEmail({
      title: notification.title,
      reason: notification.reason,
      ctaUrl,
      group,
      preferencesUrl: `${baseUrl}/settings#notifications`,
      unsubscribeUrl: `${baseUrl}/unsubscribe?token=${createUnsubscribeToken(notification.recipientUserId, group)}`,
    });

    const result = await sendEmail({
      to: user.email,
      subject: content.subject,
      text: content.text,
      html: content.html,
      link: ctaUrl,
    });

    if (result.status === "sent") {
      await db.notificationEmailDelivery.update({
        where: { id: deliveryId },
        data: { status: "sent", sentAt: new Date() },
      });
      trackEvent("email_sent", { eventType: notification.eventType, kind: "transactional" });
    } else {
      await db.notificationEmailDelivery.update({
        where: { id: deliveryId },
        data: { status: "failed", error: result.error },
      });
      console.error(
        JSON.stringify({
          type: "notification_email_failed",
          notificationId: notification.id,
          error: result.error,
        }),
      );
    }
  } catch (error) {
    // Nikdy nesmí shodit primární akci (emit už proběhl) ani samotný emit().
    console.error(
      JSON.stringify({
        type: "notification_email_error",
        notificationId: notification.id,
        message: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}
