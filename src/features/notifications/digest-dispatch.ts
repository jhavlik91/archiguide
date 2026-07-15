import "server-only";

import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/transport";
import { trackEvent } from "@/lib/analytics";
import { getVerifiedTypes } from "@/features/verification/service";
import { digestPeriodKey, digestWindowStart, type DigestFrequency } from "./digest";
import { renderDigestEmail, type DigestStats } from "./email-template";
import {
  DIGEST_UNSUBSCRIBE_TARGET,
  createUnsubscribeToken,
} from "./unsubscribe-token";

/**
 * Sestavení a odeslání periodického digestu (T033 § Main flow bod 4–5).
 * Odděleno od `email-dispatch.ts` (transakční e-mail na jednu notifikaci) —
 * digest čte přímo z `Notification`, žádnou vlastní frontu neudržuje.
 */

const RESPONSE_EVENT_TYPES = ["new_response", "response_accepted"];
const RECOMMENDATION_EVENT_TYPES = ["new_recommendation", "recommended_request"];

function isPrismaError(error: unknown, code: "P2002"): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
  );
}

async function getBaseUrl(): Promise<string> {
  if (process.env.AUTH_URL) return process.env.AUTH_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

/** ID aktivních uživatelů s danou e-mailovou frekvencí (kandidáti tohoto běhu). */
export async function listDigestRecipientIds(
  frequency: DigestFrequency,
): Promise<string[]> {
  const users = await db.user.findMany({
    where: {
      status: "active",
      notificationPreferences: { path: ["emailFrequency"], equals: frequency },
    },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

async function computeDigestStats(
  userId: string,
  windowStart: Date,
  now: Date,
): Promise<DigestStats> {
  const [newResponses, newRecommendations, unreadMessages] = await Promise.all([
    db.notification.count({
      where: {
        recipientUserId: userId,
        eventType: { in: RESPONSE_EVENT_TYPES },
        lastEventAt: { gte: windowStart, lt: now },
      },
    }),
    db.notification.count({
      where: {
        recipientUserId: userId,
        eventType: { in: RECOMMENDATION_EVENT_TYPES },
        lastEventAt: { gte: windowStart, lt: now },
      },
    }),
    db.notification.count({
      where: {
        recipientUserId: userId,
        eventType: "new_message",
        state: "unread",
        lastEventAt: { gte: windowStart, lt: now },
      },
    }),
  ]);
  return { newResponses, newRecommendations, unreadMessages };
}

export type DigestOutcome = "sent" | "empty" | "skipped" | "already_sent" | "failed";

/**
 * Sestaví a pošle digest JEDNOMU uživateli; best-effort se vzdá na prázdném
 * obsahu, neověřeném e-mailu nebo duplicitním běhu (T033 § Edge cases).
 * Idempotence: rezervace řádku `NotificationEmailDelivery` s unikátním
 * `(recipientUserId, kind, periodKey)` PŘED odesláním — souběžný/opakovaný
 * běh pro stejnou periodu narazí na P2002 a nic neposílá znovu.
 */
export async function dispatchDigestForUser(
  userId: string,
  frequency: DigestFrequency,
  now: Date,
): Promise<DigestOutcome> {
  try {
    const windowStart = digestWindowStart(frequency, now);
    const stats = await computeDigestStats(userId, windowStart, now);
    if (
      stats.newResponses === 0 &&
      stats.newRecommendations === 0 &&
      stats.unreadMessages === 0
    ) {
      return "empty";
    }

    const [user, verifiedTypes] = await Promise.all([
      db.user.findUnique({ where: { id: userId }, select: { email: true } }),
      getVerifiedTypes(userId),
    ]);
    if (!user || !verifiedTypes.includes("email")) return "skipped";

    const periodKey = digestPeriodKey(frequency, now);
    const kind = frequency === "daily" ? "daily_digest" : "weekly_digest";

    let deliveryId: string;
    try {
      const delivery = await db.notificationEmailDelivery.create({
        data: { recipientUserId: userId, kind, status: "queued", periodKey },
      });
      deliveryId = delivery.id;
    } catch (error) {
      if (isPrismaError(error, "P2002")) return "already_sent";
      throw error;
    }

    const baseUrl = await getBaseUrl();
    const content = renderDigestEmail({
      stats,
      frequency,
      preferencesUrl: `${baseUrl}/settings#notifications`,
      unsubscribeUrl: `${baseUrl}/unsubscribe?token=${createUnsubscribeToken(userId, DIGEST_UNSUBSCRIBE_TARGET)}`,
      appUrl: baseUrl,
    });

    const result = await sendEmail({
      to: user.email,
      subject: content.subject,
      text: content.text,
      html: content.html,
    });

    if (result.status === "sent") {
      await db.notificationEmailDelivery.update({
        where: { id: deliveryId },
        data: { status: "sent", sentAt: new Date() },
      });
      trackEvent("digest_sent", { frequency });
      return "sent";
    }

    await db.notificationEmailDelivery.update({
      where: { id: deliveryId },
      data: { status: "failed", error: result.error },
    });
    return "failed";
  } catch (error) {
    console.error(
      JSON.stringify({
        type: "digest_error",
        userId,
        frequency,
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    return "failed";
  }
}
