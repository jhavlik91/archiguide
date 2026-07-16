"use server";

import { revalidatePath } from "next/cache";
import { getActor } from "@/lib/session";
import { getMembershipRole } from "@/features/organizations/service";
import { roleAtLeast } from "@/features/organizations/rules";
// Import zároveň registruje oprávnění hodnocení (reviews.create/reply/dispute).
import {
  canCreateReview,
  canDisputeReview,
  canReplyToReview,
} from "./permissions";
import {
  addReply,
  checkEligibility,
  createReview,
  disputeReview,
  getReviewById,
  updateReview,
} from "./service";
import {
  reviewDisputeSchema,
  reviewInputSchema,
  reviewReplySchema,
  type ReviewDisputeInput,
  type ReviewInput,
  type ReviewReplyInput,
} from "./validation";
import type { ReviewTargetRef } from "./types";

/**
 * Server akce hodnocení (T037). Tenká vrstva nad service: ověří oprávnění
 * (permission vrstva) a validaci, deleguje. Neplatné vstupy/přechody vrací
 * jako výsledek (bez vyhození), aby UI zobrazilo srozumitelnou chybu.
 */

export type ReviewActionResult = { ok: true } | { ok: false; error: string };

/** Firemní role actora u cíle-organizace (nerelevantní u profesionála-jednotlivce). */
async function resolveIsOrgEditor(
  actorUserId: string,
  target: ReviewTargetRef,
): Promise<boolean | undefined> {
  if (target.type !== "organization") return undefined;
  const role = await getMembershipRole(target.orgId, actorUserId);
  return roleAtLeast(role, "editor");
}

const ELIGIBILITY_ERRORS: Record<
  "response_not_found" | "not_accepted" | "already_reviewed",
  string
> = {
  response_not_found: "Reakce nebyla nalezena.",
  not_accepted: "Hodnotit lze jen přijatou (accepted) reakci na vaši poptávku.",
  already_reviewed: "Tuto interakci jste už ohodnotili.",
};

/**
 * Založí recenzi nad accepted interakcí (main flow bod 2). Jen vlastník
 * poptávky s ověřenou interakcí (eligibilita) — bez ní recenzi nelze založit.
 */
export async function submitReviewAction(
  evidenceResponseId: string,
  input: ReviewInput,
): Promise<ReviewActionResult> {
  const actor = await getActor();
  if (actor.kind !== "user") {
    return { ok: false, error: "Pro hodnocení se přihlaste." };
  }

  const eligibility = await checkEligibility(evidenceResponseId);
  if (!eligibility.ok) {
    return { ok: false, error: ELIGIBILITY_ERRORS[eligibility.reason] };
  }

  if (
    !canCreateReview(actor, {
      requestOwnerUserId: eligibility.requestOwnerUserId,
      isEligible: true,
    })
  ) {
    return {
      ok: false,
      error: "K založení tohoto hodnocení nemáte oprávnění.",
    };
  }

  const parsed = reviewInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Neplatné údaje hodnocení.",
    };
  }

  const result = await createReview({
    evidenceResponseId,
    reviewerUserId: actor.userId,
    input: parsed.data,
  });
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.reason === "duplicate"
          ? "Tuto interakci jste už ohodnotili."
          : ELIGIBILITY_ERRORS[result.reason],
    };
  }

  revalidatePath(`/requests/${eligibility.requestId}`);
  revalidatePath(`/poptavka/${eligibility.requestId}`);
  return { ok: true };
}

/** Upraví recenzi, dokud je v 24h okně (main flow bod 3). Jen autor recenze. */
export async function updateReviewAction(
  reviewId: string,
  input: ReviewInput,
): Promise<ReviewActionResult> {
  const actor = await getActor();
  if (actor.kind !== "user") {
    return { ok: false, error: "Pro úpravu hodnocení se přihlaste." };
  }

  const current = await getReviewById(reviewId);
  if (!current) return { ok: false, error: "Hodnocení nebylo nalezeno." };
  if (current.reviewerUserId !== actor.userId) {
    return { ok: false, error: "K úpravě tohoto hodnocení nemáte oprávnění." };
  }

  const parsed = reviewInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Neplatné údaje hodnocení.",
    };
  }

  const result = await updateReview(reviewId, actor.userId, parsed.data);
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.reason === "not_editable"
          ? "Hodnocení lze upravit jen do 24 hodin od odeslání."
          : "Hodnocení nebylo nalezeno.",
    };
  }

  return { ok: true };
}

/** Připojí právo na reakci hodnoceného (§36.3, main flow bod 5). Jen cíl recenze. */
export async function replyToReviewAction(
  reviewId: string,
  input: ReviewReplyInput,
): Promise<ReviewActionResult> {
  const actor = await getActor();
  if (actor.kind !== "user") {
    return { ok: false, error: "Pro odpověď na hodnocení se přihlaste." };
  }

  const current = await getReviewById(reviewId);
  if (!current) return { ok: false, error: "Hodnocení nebylo nalezeno." };

  const isOrgEditor = await resolveIsOrgEditor(
    actor.userId,
    current.view.target,
  );
  if (!canReplyToReview(actor, { target: current.view.target, isOrgEditor })) {
    return {
      ok: false,
      error: "K odpovědi na toto hodnocení nemáte oprávnění.",
    };
  }

  const parsed = reviewReplySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Neplatná odpověď.",
    };
  }

  const result = await addReply(reviewId, parsed.data.text);
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.reason === "already_replied"
          ? "Na hodnocení už jste jednou odpověděli."
          : "Hodnocení nebylo nalezeno.",
    };
  }

  return { ok: true };
}

/** Formální spor nad recenzí (main flow bod 6). Jen cíl recenze. */
export async function disputeReviewAction(
  reviewId: string,
  input: ReviewDisputeInput,
): Promise<ReviewActionResult> {
  const actor = await getActor();
  if (actor.kind !== "user") {
    return { ok: false, error: "Pro rozporování hodnocení se přihlaste." };
  }

  const current = await getReviewById(reviewId);
  if (!current) return { ok: false, error: "Hodnocení nebylo nalezeno." };

  const isOrgEditor = await resolveIsOrgEditor(
    actor.userId,
    current.view.target,
  );
  if (!canDisputeReview(actor, { target: current.view.target, isOrgEditor })) {
    return {
      ok: false,
      error: "K rozporování tohoto hodnocení nemáte oprávnění.",
    };
  }

  const parsed = reviewDisputeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Neplatný důvod sporu.",
    };
  }

  const result = await disputeReview(
    reviewId,
    actor.userId,
    parsed.data.reason,
  );
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.reason === "invalid_transition"
          ? "Toto hodnocení už rozporovat nelze."
          : "Hodnocení nebylo nalezeno.",
    };
  }

  return { ok: true };
}
