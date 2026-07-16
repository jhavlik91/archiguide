"use server";

import { revalidatePath } from "next/cache";
import { trackEvent } from "@/lib/analytics";
import { getActor } from "@/lib/session";
import { inviteProfessionalToRequest } from "@/features/requests/service";
import { canUpdateMatchStatus } from "./permissions";
import {
  getRecommendationContext,
  updateRecommendationStatus,
} from "./service";
import type { MatchRecommendationStatus } from "./types";

/**
 * Server akce matching UI (T029). Tenká vrstva nad `service.ts`: ověří
 * oprávnění (`canUpdateMatchStatus` — vlastník poptávky nebo admin) a deleguje.
 * Neplatný přechod/nenalezené doporučení vrací jako typovaný výsledek (bez
 * vyhození), stejná konvence jako `features/requests/actions.ts`.
 */

export type MatchActionResult = { ok: true } | { ok: false; error: string };

async function transitionMatch(
  recommendationId: string,
  status: MatchRecommendationStatus,
): Promise<MatchActionResult> {
  const actor = await getActor();
  const context = await getRecommendationContext(recommendationId);
  if (!context) return { ok: false, error: "Doporučení nebylo nalezeno." };
  if (!canUpdateMatchStatus(actor, { ownerUserId: context.ownerUserId })) {
    return { ok: false, error: "K této akci nemáte oprávnění." };
  }

  const result = await updateRecommendationStatus(recommendationId, status);
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.reason === "invalid_transition"
          ? "Tento přechod v aktuálním stavu není možný."
          : "Doporučení nebylo nalezeno.",
    };
  }

  revalidatePath(`/requests/${context.requestId}`);
  return { ok: true };
}

/** Uloží kandidáta do užšího výběru (§ Main flow bod 3). */
export async function shortlistMatchAction(
  recommendationId: string,
): Promise<MatchActionResult> {
  return transitionMatch(recommendationId, "shortlisted");
}

/** Skryje kandidáta (vratné — viz `restoreMatchAction`, § Main flow bod 4). */
export async function dismissMatchAction(
  recommendationId: string,
): Promise<MatchActionResult> {
  return transitionMatch(recommendationId, "dismissed");
}

/** Obnoví dříve skrytého kandidáta zpět mezi doporučení. */
export async function restoreMatchAction(
  recommendationId: string,
): Promise<MatchActionResult> {
  return transitionMatch(recommendationId, "shown");
}

/** Stavy poptávky, kdy má oslovení kandidáta ještě smysl (stejná množina jako „upřesnit poptávku" v `PublishedView`). */
const INVITABLE_REQUEST_STATUSES = new Set([
  "active",
  "in_discussion",
  "paused",
]);

/**
 * Osloví kandidáta u NEVEŘEJNÉ poptávky — vytvoří `RequestInvite` (§ Main flow
 * bod 3; idempotentní, opětovné pozvání stejného kandidáta se nerozbije).
 * U veřejné poptávky tuhle akci UI nevolá vůbec (odkazuje na veřejný profil /
 * CTA k reakci) — server by pozvánku sice založil, ale bez reálného využití
 * (T027 „reakce na poptávku" zatím neexistuje).
 */
export async function inviteMatchCandidateAction(
  recommendationId: string,
): Promise<MatchActionResult> {
  const actor = await getActor();
  if (actor.kind !== "user") {
    return { ok: false, error: "Nejste přihlášeni." };
  }
  const context = await getRecommendationContext(recommendationId);
  if (!context) return { ok: false, error: "Doporučení nebylo nalezeno." };
  if (!canUpdateMatchStatus(actor, { ownerUserId: context.ownerUserId })) {
    return { ok: false, error: "K této akci nemáte oprávnění." };
  }
  // Skrytého kandidáta nelze oslovit (UI tlačítko schová, ale server to musí
  // vynutit i při přímém volání akce) a poptávka musí být v aktivní fázi —
  // uzavřenou/zrušenou/vypršelou poptávku oslovovat nemá smysl.
  if (context.status === "dismissed") {
    return {
      ok: false,
      error: "Tento kandidát je skrytý — nejdřív ho obnovte.",
    };
  }
  if (!INVITABLE_REQUEST_STATUSES.has(context.requestStatus)) {
    return { ok: false, error: "Tuto poptávku už oslovovat nelze." };
  }

  const result = await inviteProfessionalToRequest({
    requestId: context.requestId,
    invitedUserId: context.candidateUserId,
    invitedByUserId: actor.userId,
  });
  if (!result.ok) return { ok: false, error: "Poptávka nebyla nalezena." };

  trackEvent("match_invited", {
    requestId: context.requestId,
    recommendationId,
  });
  revalidatePath(`/requests/${context.requestId}`);
  return { ok: true };
}

/**
 * Zaznamená prokliknutí na profil kandidáta (§ Analytics — `match_profile_viewed`).
 * `trackEvent` je serverová vrstva — z klienta jde jen přes tuhle akci, stejný
 * princip jako `trackSearchResultClick` v `features/search/actions.ts`.
 * Best-effort, nikdy neblokuje proklik.
 */
export async function trackMatchProfileViewedAction(
  recommendationId: string,
): Promise<void> {
  trackEvent("match_profile_viewed", { recommendationId });
}
