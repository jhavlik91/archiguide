import "server-only";

import { getActor } from "@/lib/session";
import { readSessionToken } from "./session-cookie";
import type { GuideSessionAccessor } from "./permissions";

/**
 * Sestaví identitu žadatele o guide session (T018) z aktuálního requestu:
 * `userId` přihlášeného uživatele (jinak `null`) a `token` anonymní session
 * z cookie. Předává se do service vrstvy (`getSession`, `answerStep`, …), kde
 * `canAccessSession` rozhodne o přístupu (shoda userId NEBO držení tokenu).
 */
export async function getGuideAccessor(): Promise<GuideSessionAccessor> {
  const [actor, token] = await Promise.all([getActor(), readSessionToken()]);
  return {
    userId: actor.kind === "user" ? actor.userId : null,
    token: token ?? null,
  };
}
