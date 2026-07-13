"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getActor } from "@/lib/session";
import { getGuideAccessor } from "@/features/guide/accessor";
// Import zároveň registruje oprávnění briefu (brief.create/read/write).
import { canCreateBrief, canReadBrief, canWriteBrief } from "./permissions";
import {
  generateBriefFromSession,
  getBriefById,
  markBriefReady,
} from "./service";

/**
 * Server akce briefu (T021). Tenká vrstva nad service: ověří oprávnění (permission
 * vrstva) a deleguje. Chyby s návratem do UI vrací jako výsledek; navigační akce
 * (CTA z guide) přesměrují.
 */

/**
 * Vytvoří (nebo otevře existující) brief z dokončené guide session a přejde na
 * jeho náhled. Volá se jako `action` z obrazovky dokončení guide.
 *
 * NEPŘIHLÁŠENÝ (matice „Vytvořit brief" = C): pošle se na registraci s návratem
 * zpět na guide. Session drží cookie token, po registraci se připojí k účtu
 * (T017) a druhý pokus už brief založí.
 */
export async function createBriefFromGuide(sessionId: string): Promise<void> {
  const actor = await getActor();
  if (actor.kind !== "user") {
    redirect(`/register?next=${encodeURIComponent(`/guide/${sessionId}`)}`);
  }
  if (!canCreateBrief(actor)) {
    redirect(`/guide/${sessionId}?error=brief_forbidden`);
  }

  const guideAccessor = await getGuideAccessor();
  const result = await generateBriefFromSession({
    sessionId,
    ownerUserId: actor.userId,
    guideAccessor,
  });
  if (!result.ok) {
    redirect(`/guide/${sessionId}?error=brief_${result.reason}`);
  }

  revalidatePath("/dashboard");
  redirect(`/brief/${result.view.id}`);
}

export type BriefActionResult =
  { ok: true; redirectTo?: string } | { ok: false; error: string };

/**
 * Přechod briefu `draft → ready` („Uložit brief"). Vlastník only. Vrací výsledek
 * (bez vyhození), aby náhled uměl zobrazit chybu.
 */
export async function markBriefReadyAction(
  briefId: string,
): Promise<BriefActionResult> {
  const actor = await getActor();
  const brief = await getBriefById(briefId);
  if (!brief.ok) return { ok: false, error: "Brief nebyl nalezen." };
  if (!canWriteBrief(actor, { ownerUserId: brief.view.ownerUserId })) {
    return { ok: false, error: "K tomuto briefu nemáte přístup." };
  }

  const result = await markBriefReady(briefId);
  if (!result.ok) {
    return { ok: false, error: "Brief teď nelze označit jako připravený." };
  }
  revalidatePath(`/brief/${briefId}`);
  return { ok: true };
}

/**
 * Přegeneruje draft brief z aktuální session (např. po úpravě odpovědí).
 * Vlastník only. Sdílený brief se nepřepíše (service ho vrátí beze změny).
 */
export async function regenerateBriefAction(
  briefId: string,
): Promise<BriefActionResult> {
  const actor = await getActor();
  if (actor.kind !== "user")
    return { ok: false, error: "Přihlaste se prosím." };

  const brief = await getBriefById(briefId);
  if (!brief.ok) return { ok: false, error: "Brief nebyl nalezen." };
  if (!canReadBrief(actor, { ownerUserId: brief.view.ownerUserId })) {
    return { ok: false, error: "K tomuto briefu nemáte přístup." };
  }
  if (!brief.view.guideSessionId) {
    return {
      ok: false,
      error: "Zdrojová session už neexistuje — brief nelze přegenerovat.",
    };
  }

  const guideAccessor = await getGuideAccessor();
  const result = await generateBriefFromSession({
    sessionId: brief.view.guideSessionId,
    ownerUserId: actor.userId,
    guideAccessor,
  });
  if (!result.ok) {
    return { ok: false, error: "Přegenerování se nezdařilo." };
  }
  revalidatePath(`/brief/${briefId}`);
  return { ok: true };
}
