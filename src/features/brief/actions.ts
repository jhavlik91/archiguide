"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getActor } from "@/lib/session";
import { getGuideAccessor } from "@/features/guide/accessor";
// Import zároveň registruje oprávnění briefu (brief.create/read/write).
import { canCreateBrief, canReadBrief, canWriteBrief } from "./permissions";
import {
  archiveBrief,
  generateBriefFromSession,
  getBriefById,
  markBriefReady,
  revokeShare,
  shareBrief,
  updateBriefContent,
} from "./service";
import { briefEditSchema } from "./content";
import { detectPrivacyWarnings, type PrivacyWarningKind } from "./privacy";
import { sharedBriefPath } from "./paths";
import type { BriefContent, BriefStatus } from "./types";

/**
 * Textová pole briefu, která scanujeme na osobní údaje před sdílením
 * (zadani/12 §8). Přesnou adresu (`location.address`) sem NEdáváme — to je
 * vědomě soukromé pole, ne omylem vepsaný kontakt; do sdílené verze se navíc
 * nepromítá (`redactBriefPrivate`).
 */
function scannableTexts(title: string, content: BriefContent): string[] {
  return [
    title,
    content.summary,
    content.goal,
    content.projectType,
    content.currentState ?? "",
    content.scope ?? "",
    content.timing ?? "",
    content.location?.display ?? "",
    content.budget.display,
    content.budget.scope ?? "",
    content.nextStep ?? "",
    ...content.preferences.map((p) => `${p.label} ${p.value}`),
    ...content.risks,
    ...content.recommendedProfessions.map((p) => p.reason),
  ];
}

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

// --- Editace (autosave) -----------------------------------------------------

export type SaveBriefResult =
  { ok: true; status: BriefStatus } | { ok: false; error: string };

/**
 * Uloží manuální úpravu briefu (T022 § Main flow 1) — volá se autosavem editoru,
 * nikdy neztratit rozpracované změny. Vlastník only. Vrací nový stav, aby editor
 * uměl zobrazit přechod `shared → revised`.
 */
export async function saveBriefContentAction(
  briefId: string,
  input: unknown,
): Promise<SaveBriefResult> {
  const actor = await getActor();
  const brief = await getBriefById(briefId);
  if (!brief.ok) return { ok: false, error: "Brief nebyl nalezen." };
  if (!canWriteBrief(actor, { ownerUserId: brief.view.ownerUserId })) {
    return { ok: false, error: "K tomuto briefu nemáte přístup." };
  }

  const parsed = briefEditSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Zkontrolujte zadané údaje.",
    };
  }

  const result = await updateBriefContent(briefId, parsed.data);
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.reason === "archived"
          ? "Archivovaný brief nelze upravovat."
          : "Uložení se nezdařilo.",
    };
  }
  revalidatePath(`/brief/${briefId}`);
  return { ok: true, status: result.view.status };
}

// --- Sdílení / odvolání -----------------------------------------------------

export type ShareBriefResult =
  | { ok: true; sharePath: string; reshared: boolean }
  // Privacy varování (zadani/12 §8) — NEBLOKUJE, čeká na potvrzení uživatele.
  | { ok: false; needsConfirmation: true; warnings: PrivacyWarningKind[] }
  | { ok: false; error: string };

/**
 * Vygeneruje/obnoví sdílený odkaz (T022 § Main flow 3–4). Před sdílením proběhne
 * privacy kontrola: obsahuje-li text vzor přesné adresy/telefonu/e-mailu a
 * uživatel to ještě nepotvrdil, vrátíme varování (neblokujeme). Vlastník only.
 */
export async function shareBriefAction(
  briefId: string,
  confirmed = false,
): Promise<ShareBriefResult> {
  const actor = await getActor();
  const brief = await getBriefById(briefId);
  if (!brief.ok) return { ok: false, error: "Brief nebyl nalezen." };
  if (!canWriteBrief(actor, { ownerUserId: brief.view.ownerUserId })) {
    return { ok: false, error: "K tomuto briefu nemáte přístup." };
  }

  if (!confirmed) {
    const warnings = detectPrivacyWarnings(
      scannableTexts(brief.view.title, brief.view.content),
    );
    if (warnings.length > 0) {
      return { ok: false, needsConfirmation: true, warnings };
    }
  }

  const result = await shareBrief(briefId);
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.reason === "not_shareable"
          ? "Tento brief teď nelze sdílet."
          : "Sdílení se nezdařilo.",
    };
  }
  revalidatePath(`/brief/${briefId}`);
  return {
    ok: true,
    sharePath: sharedBriefPath(result.token),
    reshared: result.reshared,
  };
}

export type BriefMutationResult = { ok: true } | { ok: false; error: string };

/** Odvolá sdílený odkaz (T022 § Alternative flows). Vlastník only. */
export async function revokeShareAction(
  briefId: string,
): Promise<BriefMutationResult> {
  const actor = await getActor();
  const brief = await getBriefById(briefId);
  if (!brief.ok) return { ok: false, error: "Brief nebyl nalezen." };
  if (!canWriteBrief(actor, { ownerUserId: brief.view.ownerUserId })) {
    return { ok: false, error: "K tomuto briefu nemáte přístup." };
  }

  const result = await revokeShare(briefId);
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.reason === "not_shared"
          ? "Brief není sdílený."
          : "Odvolání se nezdařilo.",
    };
  }
  revalidatePath(`/brief/${briefId}`);
  return { ok: true };
}

/** Archivuje brief (`draft → archived`). Vlastník only. */
export async function archiveBriefAction(
  briefId: string,
): Promise<BriefMutationResult> {
  const actor = await getActor();
  const brief = await getBriefById(briefId);
  if (!brief.ok) return { ok: false, error: "Brief nebyl nalezen." };
  if (!canWriteBrief(actor, { ownerUserId: brief.view.ownerUserId })) {
    return { ok: false, error: "K tomuto briefu nemáte přístup." };
  }

  const result = await archiveBrief(briefId);
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.reason === "invalid_transition"
          ? "Archivovat lze jen rozpracovaný brief."
          : "Archivace se nezdařila.",
    };
  }
  revalidatePath(`/brief/${briefId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}
