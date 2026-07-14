"use server";

import { revalidatePath } from "next/cache";
import { getActor } from "@/lib/session";
// Import zároveň registruje oprávnění notifikací (access_own).
import "./permissions";
import { markAllRead } from "./service";

/**
 * Server akce notifikací (T032). Spravovat lze VÝHRADNĚ vlastní notifikace —
 * příslušnost k příjemci vynutí per-uživatel filtr ve službě. Označení JEDNÉ
 * notifikace přečtenou řeší server route `/notifications/[id]` (mark-read +
 * přesměrování do kontextu); tady zůstává hromadné označení, které nenaviguje.
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
