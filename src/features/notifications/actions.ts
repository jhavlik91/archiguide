"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { trackEvent } from "@/lib/analytics";
import { getActor } from "@/lib/session";
// Import zároveň registruje oprávnění notifikací (access_own).
import { canAccessNotification } from "./permissions";
import {
  getNotificationForRecipient,
  markAllRead,
  markRead,
} from "./service";

/**
 * Server akce notifikací (T032). Spravovat lze VÝHRADNĚ vlastní notifikace —
 * příslušnost k příjemci vynutí `canAccessNotification` i per-uživatel filtr ve
 * službě (cizí notifikaci nikdo neoznačí). Chyby se vrací jako výsledek (bez
 * vyhození), UI je jen tiše ignoruje — jde o vedlejší efekt čtení.
 */

export type SimpleResult = { ok: boolean };

const idSchema = z.object({ id: z.string().min(1) });

/**
 * Označí jednu notifikaci jako přečtenou. Volá klient při otevření notifikace
 * (klik vede do kontextu a zároveň označí přečteno). Cizí / neexistující → `ok: false`,
 * bez potvrzení existence.
 */
export async function markNotificationRead(
  input: unknown,
): Promise<SimpleResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false };

  const actor = await getActor();
  if (actor.kind !== "user") return { ok: false };

  const notification = await getNotificationForRecipient(
    parsed.data.id,
    actor.userId,
  );
  if (
    !notification ||
    !canAccessNotification(actor, {
      recipientUserId: notification.recipientUserId,
    })
  ) {
    return { ok: false };
  }

  const changed = await markRead(notification.id, actor.userId);
  if (changed > 0) {
    trackEvent("notification.opened", { eventType: notification.eventType });
  }
  revalidatePath("/notifications");
  return { ok: true };
}

/** Označí všechny nepřečtené notifikace diváka jako přečtené (hromadně). */
export async function markAllNotificationsRead(): Promise<SimpleResult> {
  const actor = await getActor();
  if (actor.kind !== "user") return { ok: false };
  await markAllRead(actor.userId);
  revalidatePath("/notifications");
  return { ok: true };
}
