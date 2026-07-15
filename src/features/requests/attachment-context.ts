import "server-only";

import { registerContextResolver } from "@/lib/attachments";
import { type Actor, isUser } from "@/lib/permissions";
import { getRequestVisibilityMeta, isUserInvitedToRequest } from "./service";

/**
 * Seam mezi poptávkou (T025) a attachment systémem (T023): registruje resolver
 * pro kontext `request`. Kontext existuje, pokud poptávka existuje; ÚČASTNÍKEM
 * je vlastník nebo pozvaný profesionál (private) — veřejný návštěvník NENÍ
 * účastník, takže `shared_in_context` přílohy se mu nezpřístupní (jen `public`
 * — main flow bod 5, „citlivé přílohy zůstávají skryté do fáze konverzace").
 *
 * Registrace je side-effect importu; zavádí ji `lib/attachment-contexts.ts`
 * (a při startu serveru `instrumentation.ts`), aby ji znaly i attachment routy
 * (`/api/attachments/*`), které doménu poptávky jinak neimportují — stejný
 * vzor jako `features/messaging/attachment-context.ts` (T031).
 */
registerContextResolver("request", async (contextId: string, actor: Actor) => {
  const meta = await getRequestVisibilityMeta(contextId);
  if (!meta) return { exists: false, isParticipant: false };
  if (!isUser(actor)) return { exists: true, isParticipant: false };
  if (actor.userId === meta.ownerUserId) {
    return { exists: true, isParticipant: true };
  }
  const invited = await isUserInvitedToRequest(contextId, actor.userId);
  return { exists: true, isParticipant: invited };
});
