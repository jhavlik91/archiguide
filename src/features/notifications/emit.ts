import "server-only";

import { trackEvent } from "@/lib/analytics";
import { dispatchNotificationEmail } from "./email-dispatch";
import {
  buildDedupeKey,
  emailFrequency,
  eventDefinition,
  wantsEmail,
  wantsInApp,
} from "./rules";
import {
  createOrBumpNotification,
  getNotificationPreferences,
  recipientIsDeliverable,
} from "./service";
import { type NotificationPriority } from "./types";

/**
 * Jednotné emit API notifikací (T032) — JEDINÝ vstupní bod, kterým domény hlásí
 * události. Veřejně se importuje přes `@/lib/notifications`.
 *
 * Návrhové zásady:
 *  - **Best-effort**: notifikace je vedlejší efekt primární akce. Emit NIKDY
 *    nevyhodí — selhání jen zaloguje a vrátí `skipped`, aby nikdy neshodilo
 *    odeslání zprávy, publikaci reakce apod.
 *  - **Vlastní akce nenotifikuje**: `actorUserId === recipientUserId` → skip.
 *  - **Katalog rozhoduje**: neznámý typ události → skip (typ je z katalogu).
 *  - **Preference & politika**: respektuje uložené preference kanálů; když
 *    příjemce in-app kanál pro událost nechce, notifikace nevznikne.
 *  - **Deduplikace**: sekvenční emity se stejným klíčem, dokud je notifikace
 *    nepřečtená, sloučí do jedné s počtem (řeší datová vrstva).
 */

export type EmitInput = {
  /** Typ události z katalogu (`EVENT_CATALOG`). */
  eventType: string;
  /** Komu notifikace patří. */
  recipientUserId: string;
  /** Kdo akci vyvolal — když je roven příjemci, notifikace se neemituje. */
  actorUserId?: string;
  /** Krátký titulek bez citlivého obsahu (např. „Nová zpráva"). */
  title: string;
  /** Důvod, proč notifikaci příjemce dostal (musí ho znát). */
  reason: string;
  /** Cíl kliknutí — relativní cesta do kontextu (povinná). */
  link: string;
  /** Polymorfní kontext zdroje (bez FK). Slouží i k odvození dedup klíče. */
  context?: { type: string; id: string };
  /** Explicitní klíč deduplikace (jinak se odvodí z typu a kontextu). */
  dedupeKey?: string;
  /** Přepis default priority z katalogu. */
  priority?: NotificationPriority;
};

export type EmitResult =
  | { status: "created"; id: string }
  | { status: "deduped"; id: string }
  | {
      status: "skipped";
      reason:
        | "self"
        | "unknown_event"
        | "channel_off"
        | "undeliverable"
        | "invalid"
        | "error";
    };

export async function emit(input: EmitInput): Promise<EmitResult> {
  try {
    const def = eventDefinition(input.eventType);
    if (!def) {
      // Programátorská chyba (typ mimo katalog) — hlasitě do logu, ale nespadneme.
      console.warn(
        JSON.stringify({
          type: "notification_skip",
          reason: "unknown_event",
          eventType: input.eventType,
        }),
      );
      return { status: "skipped", reason: "unknown_event" };
    }

    if (!input.recipientUserId || !input.link || input.link.trim().length === 0) {
      return { status: "skipped", reason: "invalid" };
    }

    // Vlastní akce nenotifikuje (T032 § Alternative flows).
    if (input.actorUserId && input.actorUserId === input.recipientUserId) {
      return { status: "skipped", reason: "self" };
    }

    // Nedoručujeme zrušenému účtu (nemá kdo číst).
    if (!(await recipientIsDeliverable(input.recipientUserId))) {
      return { status: "skipped", reason: "undeliverable" };
    }

    // Respektuj uložené preference kanálů (preferenční UI je T033).
    const prefs = await getNotificationPreferences(input.recipientUserId);
    if (!wantsInApp(input.eventType, prefs)) {
      return { status: "skipped", reason: "channel_off" };
    }

    const dedupeKey = buildDedupeKey(
      input.eventType,
      input.context ?? null,
      input.dedupeKey,
    );

    const { notification, created } = await createOrBumpNotification({
      recipientUserId: input.recipientUserId,
      eventType: input.eventType,
      priority: input.priority ?? def.priority,
      title: input.title,
      reason: input.reason,
      linkPath: input.link,
      context: input.context ?? null,
      dedupeKey,
    });

    if (created) {
      // Analytika bez citlivých dat v názvech (zadani/14).
      trackEvent("notification.created", {
        eventType: input.eventType,
        priority: notification.priority,
      });

      // E-mail jen na NOVĚ vzniklou notifikaci (T033), nikdy na dedup-bump —
      // jinak by 5 zpráv v konverzaci poslalo 5 e-mailů místo jednoho. Frekvence
      // "daily"/"weekly" odloží doručení do digestu (cron), takže se okamžitě
      // neposílá nic — digest čte přímo z tabulky Notification.
      if (wantsEmail(input.eventType, prefs) && emailFrequency(prefs) === "immediate") {
        // Best-effort: dispatchNotificationEmail nikdy nevyhodí, ale i tak ho
        // izolujeme, aby selhání transportu nikdy nezměnilo výsledek emit().
        await dispatchNotificationEmail(notification).catch(() => {});
      }

      return { status: "created", id: notification.id };
    }
    return { status: "deduped", id: notification.id };
  } catch (error) {
    // Best-effort: selhání notifikace nesmí shodit primární akci. `error` (na
    // rozdíl od `invalid`) říká, že šlo o infrastrukturu (DB apod.), ne o vstup —
    // budoucí metriky/alerting je nesmí míchat.
    console.error(
      JSON.stringify({
        type: "notification_error",
        eventType: input.eventType,
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    return { status: "skipped", reason: "error" };
  }
}
