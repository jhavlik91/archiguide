import "server-only";

import { Prisma, type Notification } from "@prisma/client";
import { db } from "@/lib/db";
import { higherPriority } from "./rules";
import {
  NOTIFICATION_BELL_LIMIT,
  NOTIFICATION_PRIORITIES,
  type NotificationGroup,
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

/** Prisma chyby, přes které se dedup smyčka zotaví jinou větví. */
function isPrismaError(error: unknown, code: "P2002" | "P2025"): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
  );
}

/**
 * Vloží notifikaci, nebo — existuje-li NEPŘEČTENÁ se stejným `(recipient, dedupeKey)`
 * — jen ji „bumpne": zvýší počet, obnoví `lastEventAt` (vrátí ji nahoru v centru) a
 * případně zvýší prioritu (nikdy nesníží). `created` odliší novou notifikaci od
 * sloučené (pro analytiku `notification.created` a UI).
 *
 * Odolné vůči souběhům, které prostý find-then-write ztrácel:
 *  - závod s `markRead`: bump má ve `where` i `state: "unread"` — když čtenář
 *    notifikaci mezitím přečte, update selže (P2025) a nová událost založí novou
 *    NEPŘEČTENOU notifikaci (jinak by se tiše sloučila do přečtené a zvoneček
 *    by ji nikdy neukázal);
 *  - souběžné emity stejného klíče: duplicitní create odmítne částečný unikátní
 *    index `(recipientUserId, dedupeKey) WHERE state = 'unread'` (viz migrace
 *    `notification_dedup_unique_unread`) a P2002 se zotaví bumpem řádku, který
 *    závod vyhrál.
 */
export async function createOrBumpNotification(
  input: CreateNotificationInput,
): Promise<{ notification: Notification; created: boolean }> {
  // Dva pokusy: každá větev může prohrát právě jeden závod (bump × markRead,
  // create × souběžný create) a druhé kolo ho dořeší opačnou větví.
  for (let attempt = 0; attempt < 2; attempt++) {
    const existing = await db.notification.findFirst({
      where: {
        recipientUserId: input.recipientUserId,
        dedupeKey: input.dedupeKey,
        state: "unread",
      },
    });

    if (existing) {
      try {
        const notification = await db.notification.update({
          // `state` ve where: mezitím přečtenou notifikaci nebumpneme (P2025).
          where: { id: existing.id, state: "unread" },
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
      } catch (error) {
        if (!isPrismaError(error, "P2025")) throw error;
        // markRead vyhrál závod — projdeme na create nové nepřečtené.
      }
    }

    try {
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
    } catch (error) {
      if (!isPrismaError(error, "P2002")) throw error;
      // Souběžný emit založil nepřečtený řádek první — další kolo ho bumpne.
    }
  }
  throw new Error(
    "createOrBumpNotification: dedup se nepodařilo vyřešit ani na druhý pokus",
  );
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

/**
 * Uloží celé preference (T033 preferenční UI — matice skupina × kanál +
 * frekvence e-mailu). Nahrazuje uložený JSON celý — volající (server akce)
 * skládá výsledný objekt z formuláře, aby zápis zůstal jedním místem pravdy.
 */
export async function saveNotificationPreferences(
  userId: string,
  prefs: NotificationPreferences,
): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: { notificationPreferences: prefs as Prisma.InputJsonValue },
  });
}

/**
 * Vrátí frekvenci e-mailu na `immediate` (unsubscribe z periodického digestu,
 * T033 § Alternative flows — digest sám žádnou skupinu nereprezentuje, takže
 * se neruší kanál, ale odloženě posílané e-maily se vrátí k okamžitým).
 */
export async function resetEmailFrequency(userId: string): Promise<void> {
  const prefs = await getNotificationPreferences(userId);
  await saveNotificationPreferences(userId, { ...prefs, emailFrequency: "immediate" });
}

/**
 * Vypne e-mailový kanál pro CELOU skupinu událostí (one-click unsubscribe z
 * patičky e-mailu, T033 § Alternative flows). Čte-přepiš-zapiš na stejném
 * JSON sloupci — unsubscribe je vzácná, uživatelem iniciovaná akce, souběh s
 * jinou změnou preferencí ve stejné milisekundě není reálné riziko.
 */
export async function disableGroupEmail(
  userId: string,
  group: NotificationGroup,
): Promise<void> {
  const prefs = await getNotificationPreferences(userId);
  const nextPrefs: NotificationPreferences = {
    ...prefs,
    groups: {
      ...prefs.groups,
      [group]: { ...prefs.groups?.[group], email: false },
    },
  };
  await saveNotificationPreferences(userId, nextPrefs);
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
