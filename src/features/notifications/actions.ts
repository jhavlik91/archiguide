"use server";

import { revalidatePath } from "next/cache";
import { getActor } from "@/lib/session";
// Import zároveň registruje oprávnění notifikací (access_own).
import "./permissions";
import { markAllRead, saveNotificationPreferences } from "./service";
import {
  EMAIL_FREQUENCIES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_GROUPS,
  type EmailFrequency,
  type NotificationChannel,
  type NotificationGroup,
  type NotificationPreferences,
} from "./types";

/**
 * Server akce notifikací (T032, preference T033). Spravovat lze VÝHRADNĚ
 * vlastní notifikace/preference — příslušnost k příjemci vynutí per-uživatel
 * filtr ve službě. Označení JEDNÉ notifikace přečtenou řeší server route
 * `/notifications/[id]` (mark-read + přesměrování do kontextu); tady zůstává
 * hromadné označení, které nenaviguje.
 */

export type SimpleResult = { ok: boolean };

/** Označí všechny nepřečtené notifikace diváka jako přečtené (hromadně). */
export async function markAllNotificationsRead(): Promise<SimpleResult> {
  const actor = await getActor();
  if (actor.kind !== "user") return { ok: false };
  await markAllRead(actor.userId);
  revalidatePath("/notifications");
  return { ok: true };
}

/** Tvar formuláře preferenčního UI (T033 § Main flow bod 3 — matice skupina × kanál). */
export type NotificationPreferencesFormInput = {
  groups: Partial<Record<NotificationGroup, Partial<Record<NotificationChannel, boolean>>>>;
  emailFrequency: EmailFrequency;
};

/**
 * Uloží preference vlastníka. Validace proti otevřenému, ale konečnému
 * seznamu skupin/kanálů/frekvencí — cizí klíče z pozměněného requestu se
 * tiše zahodí. Kritické servisní události (T011 verifikace) i tak dostanou
 * in-app vždy — vynucuje to `resolveChannels`, ne tahle akce (T033 § Main flow
 * bod 3), takže není co tu speciálně blokovat.
 */
export async function updateNotificationPreferences(
  input: NotificationPreferencesFormInput,
): Promise<SimpleResult> {
  const actor = await getActor();
  if (actor.kind !== "user") return { ok: false };

  const groups: NotificationPreferences["groups"] = {};
  for (const group of NOTIFICATION_GROUPS) {
    const raw = input.groups[group];
    if (!raw) continue;
    const entry: Partial<Record<NotificationChannel, boolean>> = {};
    for (const channel of NOTIFICATION_CHANNELS) {
      if (typeof raw[channel] === "boolean") entry[channel] = raw[channel];
    }
    groups[group] = entry;
  }

  const emailFrequency = EMAIL_FREQUENCIES.includes(input.emailFrequency)
    ? input.emailFrequency
    : "immediate";

  await saveNotificationPreferences(actor.userId, { groups, emailFrequency });
  revalidatePath("/settings");
  return { ok: true };
}
