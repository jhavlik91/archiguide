"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { trackEvent } from "@/lib/analytics";
import { getActor } from "@/lib/session";
import { getBriefById } from "@/features/brief/service";
import { canReadBrief } from "@/features/brief/permissions";
import {
  detectPrivacyWarnings,
  type PrivacyWarningKind,
} from "@/features/brief/privacy";
import type { BriefContent } from "@/features/brief/types";
// Import zároveň registruje oprávnění poptávky (requests.create/read/write/publish/read_public).
import {
  canCreateRequest,
  canPublishRequest,
  canWriteRequest,
} from "./permissions";
import {
  createRequestFromBrief,
  getRequestById,
  refinePublishedRequest,
  setRequestVisibility,
  transitionRequest,
  updateDraftRequest,
} from "./service";
import { isMoreOpenVisibility } from "./public-view";
import {
  requestInputSchema,
  requestRefineSchema,
  requestVisibilitySchema,
  type RequestInput,
  type RequestRefineInput,
  type RequestVisibilityInput,
} from "./validation";
import type { RequestAction } from "./state-machine";
import type { RequestView } from "./types";

/**
 * Server akce poptávky (T024). Tenká vrstva nad service: ověří oprávnění
 * (permission vrstva) a deleguje. Neplatné přechody/validace vrací jako výsledek
 * (bez vyhození), aby UI zobrazilo srozumitelnou chybu; navigační akce přesměrují.
 */

export type RequestActionResult =
  { ok: true; redirectTo?: string } | { ok: false; error: string };

/**
 * Vytvoří `draft` poptávku z briefu (předvyplněnou) a přejde na její detail.
 * Volá se jako `action` z náhledu briefu. Nepřihlášeného pošle na login;
 * bez oprávnění (účet POUZE moderátor) zpět na brief s chybou.
 */
export async function createRequestFromBriefAction(
  briefId: string,
): Promise<void> {
  const actor = await getActor();
  if (actor.kind !== "user") {
    redirect(`/login?next=${encodeURIComponent(`/brief/${briefId}`)}`);
  }
  if (!canCreateRequest(actor)) {
    redirect(`/brief/${briefId}?error=request_forbidden`);
  }

  // Poptávku smí z briefu založit jen jeho vlastník (brief = soukromá data).
  const brief = await getBriefById(briefId);
  if (!brief.ok) redirect(`/dashboard?error=brief_not_found`);
  if (!canReadBrief(actor, { ownerUserId: brief.view.ownerUserId })) {
    redirect(`/brief/${briefId}?error=request_forbidden`);
  }

  const result = await createRequestFromBrief({
    briefId,
    ownerUserId: actor.userId,
  });
  if (!result.ok) {
    redirect(`/brief/${briefId}?error=request_${result.reason}`);
  }

  revalidatePath("/requests");
  redirect(`/requests/${result.view.id}`);
}

/** Uloží úpravy DRAFT poptávky. Vlastník/admin only. */
export async function updateDraftRequestAction(
  requestId: string,
  input: RequestInput,
): Promise<RequestActionResult> {
  const actor = await getActor();
  const current = await getRequestById(requestId);
  if (!current.ok) return { ok: false, error: "Poptávka nebyla nalezena." };
  if (!canWriteRequest(actor, { ownerUserId: current.view.ownerUserId })) {
    return { ok: false, error: "K této poptávce nemáte přístup." };
  }

  const parsed = requestInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Neplatné údaje poptávky.",
    };
  }

  const result = await updateDraftRequest(requestId, parsed.data);
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.reason === "not_editable"
          ? "Publikovanou poptávku už takto upravit nelze."
          : "Poptávka nebyla nalezena.",
    };
  }
  revalidatePath(`/requests/${requestId}`);
  return { ok: true };
}

export type RefineRequestResult =
  | { ok: true }
  | { ok: false; needsConfirmation: true; warnings: PrivacyWarningKind[] }
  | { ok: false; error: string };

/**
 * Upřesní publikovanou poptávku (rozpočet/termín/časový horizont). Vlastník/
 * admin. Je-li poptávka `public`/`shared_link` (tato pole už jsou veřejně
 * vidět — main flow bod 4), NOVÉ hodnoty projdou stejnou sanitizační kontrolou
 * jako zpřístupňující změna viditelnosti (jinak by šlo telefon propašovat do
 * rozpočtu/horizontu bez varování POTÉ, co je poptávka už veřejná).
 */
export async function refineRequestAction(
  requestId: string,
  patch: RequestRefineInput,
  confirmed = false,
): Promise<RefineRequestResult> {
  const actor = await getActor();
  const current = await getRequestById(requestId);
  if (!current.ok) return { ok: false, error: "Poptávka nebyla nalezena." };
  if (!canWriteRequest(actor, { ownerUserId: current.view.ownerUserId })) {
    return { ok: false, error: "K této poptávce nemáte přístup." };
  }

  const parsed = requestRefineSchema.safeParse(patch);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Neplatné údaje poptávky.",
    };
  }

  if (!confirmed && current.view.visibility !== "private") {
    const warnings = detectPrivacyWarnings(
      scannableRequestTexts(
        {
          title: current.view.title,
          region: current.view.region,
          budget: parsed.data.budget,
          timeline: parsed.data.timeline,
        },
        current.view.briefSnapshot,
      ),
    );
    if (warnings.length > 0) {
      trackEvent("request.privacy_warning_shown", { requestId, warnings });
      return { ok: false, needsConfirmation: true, warnings };
    }
  }

  const result = await refinePublishedRequest(requestId, parsed.data);
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.reason === "not_editable"
          ? "Tuto poptávku už upravit nelze."
          : "Poptávka nebyla nalezena.",
    };
  }
  revalidatePath(`/requests/${requestId}`);
  return { ok: true };
}

/**
 * Provede stavový přechod poptávky. Publikace se řídí maticí (`canPublishRequest`
 * dle typu); ostatní přechody smí vlastník/admin (`canWriteRequest`). Neplatný
 * přechod odmítne server (stavový automat).
 */
export async function transitionRequestAction(
  requestId: string,
  action: RequestAction,
): Promise<RequestActionResult> {
  const actor = await getActor();
  const current = await getRequestById(requestId);
  if (!current.ok) return { ok: false, error: "Poptávka nebyla nalezena." };

  const subject = { ownerUserId: current.view.ownerUserId };
  const allowed =
    action === "publish"
      ? canPublishRequest(actor, { ...subject, type: current.view.type })
      : canWriteRequest(actor, subject);
  if (!allowed) {
    return {
      ok: false,
      error:
        action === "publish"
          ? "K publikaci této poptávky nemáte oprávnění."
          : "K této akci nemáte oprávnění.",
    };
  }

  // Publikace vyžaduje kompletní povinná pole (§Validation) — draft mohl vzniknout
  // z briefu bez regionu/profesí. Publikovat lze až po jejich doplnění.
  if (action === "publish") {
    if (current.view.targetProfessionSlugs.length < 1) {
      return {
        ok: false,
        error: "Před publikací vyberte alespoň jednu cílovou profesi.",
      };
    }
    if (current.view.region.trim().length === 0) {
      return { ok: false, error: "Před publikací doplňte region poptávky." };
    }
  }

  const result = await transitionRequest({
    requestId,
    action,
    actorUserId: actor.kind === "user" ? actor.userId : null,
  });
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.reason === "invalid_transition"
          ? "Tento přechod v aktuálním stavu není možný."
          : "Poptávka nebyla nalezena.",
    };
  }
  revalidatePath(`/requests/${requestId}`);
  revalidatePath("/requests");
  return { ok: true };
}

/**
 * Textová pole poptávky skenovaná na osobní údaje před zveřejněním (main flow
 * bod 4, stejný princip jako `scannableTexts` v `brief/actions.ts`). Přesnou
 * adresu briefu (`location.address`) sem NEdáváme — je vědomě soukromá a do
 * anonymizované projekce se stejně nikdy nepromítne (`redactBriefPrivate`).
 */
function scannableRequestTexts(
  view: Pick<RequestView, "title" | "region" | "budget" | "timeline">,
  briefContent: BriefContent | null,
): string[] {
  const texts = [
    view.title,
    view.region,
    view.budget ?? "",
    view.timeline ?? "",
  ];
  if (briefContent) {
    texts.push(
      briefContent.summary,
      briefContent.goal,
      briefContent.projectType,
      briefContent.currentState ?? "",
      briefContent.scope ?? "",
      briefContent.timing ?? "",
      briefContent.location?.display ?? "",
      briefContent.budget.display,
      briefContent.budget.scope ?? "",
      briefContent.nextStep ?? "",
      ...briefContent.preferences.map((p) => `${p.label} ${p.value}`),
      ...briefContent.risks,
      ...briefContent.recommendedProfessions.map((p) => p.reason),
    );
  }
  return texts;
}

export type SetVisibilityResult =
  | { ok: true }
  | { ok: false; needsConfirmation: true; warnings: PrivacyWarningKind[] }
  | { ok: false; error: string };

/**
 * Nastaví viditelnost poptávky (main flow bod 1; alternative flow — změna
 * `public → private` po publikaci). Zpřístupňující změna (private → public) BEZ
 * potvrzení nejdřív proskenuje text na PII vzory (main flow bod 4, zadani/05 —
 * „publikace identity u anonymizované poptávky" = citlivá akce s explicitním
 * potvrzením); nález NEBLOKUJE, jen si vyžádá `confirmed: true`. Vlastník/admin
 * only.
 */
export async function setRequestVisibilityAction(
  requestId: string,
  visibility: RequestVisibilityInput,
  confirmed = false,
): Promise<SetVisibilityResult> {
  const actor = await getActor();
  const current = await getRequestById(requestId);
  if (!current.ok) return { ok: false, error: "Poptávka nebyla nalezena." };
  if (!canWriteRequest(actor, { ownerUserId: current.view.ownerUserId })) {
    return { ok: false, error: "K této poptávce nemáte přístup." };
  }

  const parsed = requestVisibilitySchema.safeParse(visibility);
  if (!parsed.success) {
    return { ok: false, error: "Neplatná viditelnost poptávky." };
  }

  if (
    !confirmed &&
    isMoreOpenVisibility(parsed.data, current.view.visibility)
  ) {
    const warnings = detectPrivacyWarnings(
      scannableRequestTexts(current.view, current.view.briefSnapshot),
    );
    if (warnings.length > 0) {
      trackEvent("request.privacy_warning_shown", { requestId, warnings });
      return { ok: false, needsConfirmation: true, warnings };
    }
  }

  const result = await setRequestVisibility(requestId, parsed.data);
  if (!result.ok) return { ok: false, error: "Poptávka nebyla nalezena." };

  revalidatePath(`/requests/${requestId}`);
  revalidatePath(`/poptavka/${requestId}`);
  return { ok: true };
}
