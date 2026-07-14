"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getActor } from "@/lib/session";
import { getBriefById } from "@/features/brief/service";
import { canReadBrief } from "@/features/brief/permissions";
// Import zároveň registruje oprávnění poptávky (requests.create/read/write/publish).
import {
  canCreateRequest,
  canPublishRequest,
  canWriteRequest,
} from "./permissions";
import {
  createRequestFromBrief,
  getRequestById,
  refinePublishedRequest,
  transitionRequest,
  updateDraftRequest,
} from "./service";
import {
  requestInputSchema,
  requestRefineSchema,
  type RequestInput,
  type RequestRefineInput,
} from "./validation";
import type { RequestAction } from "./state-machine";

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

/** Upřesní publikovanou poptávku (rozpočet/termín/časový horizont). Vlastník/admin. */
export async function refineRequestAction(
  requestId: string,
  patch: RequestRefineInput,
): Promise<RequestActionResult> {
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
