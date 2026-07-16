"use server";

import { revalidatePath } from "next/cache";
import { getActor } from "@/lib/session";
import {
  getRequestVisibilityMeta,
  isUserInvitedToRequest,
} from "@/features/requests/service";
// Import zároveň registruje oprávnění reakce (responses.create/read/write/manage).
import {
  canCreateResponse,
  canManageResponse,
  canWriteResponse,
} from "./permissions";
import {
  createResponse,
  getResponseById,
  resolveOrgMembership,
  transitionResponse,
  updateResponse,
} from "./service";
import {
  responseInputSchema,
  responseRejectSchema,
  type ResponseInput,
  type ResponseRejectInput,
} from "./validation";
import type { Actor } from "@/lib/permissions";
import type { ResponseAuthorRef } from "./types";

/** Firemní role actora u organizace-autora (nerelevantní u user-authored/návštěvníka). */
async function resolveIsOrgEditor(
  actor: Actor,
  author: ResponseAuthorRef,
): Promise<boolean | undefined> {
  if (author.type !== "organization" || actor.kind !== "user") return undefined;
  return (await resolveOrgMembership(author.orgId, actor.userId)).isEditor;
}

/**
 * Server akce reakce na poptávku (T027). Tenká vrstva nad service: ověří
 * oprávnění (permission vrstva) a deleguje. Neplatné vstupy/přechody vrací
 * jako výsledek (bez vyhození), aby UI zobrazilo srozumitelnou chybu.
 */

export type ResponseActionResult = { ok: true } | { ok: false; error: string };

/**
 * Založí reakci na poptávku (main flow bod 2). `authorOrgId` volitelně —
 * reaguje-li actor za firmu (matice — „Firma admin"/„Firma editor"); jinak
 * reaguje jako profesionál (vlastní účet).
 */
export async function submitResponseAction(
  requestId: string,
  input: ResponseInput,
  authorOrgId?: string,
): Promise<ResponseActionResult> {
  const actor = await getActor();
  if (actor.kind !== "user") {
    return { ok: false, error: "Pro reakci na poptávku se přihlaste." };
  }

  const meta = await getRequestVisibilityMeta(requestId);
  if (!meta) return { ok: false, error: "Poptávka nebyla nalezena." };

  const author: ResponseAuthorRef = authorOrgId
    ? { type: "organization", orgId: authorOrgId }
    : { type: "user", userId: actor.userId };

  const isOrgEditor = await resolveIsOrgEditor(actor, author);
  const isInvited = await isUserInvitedToRequest(requestId, actor.userId);

  if (
    !canCreateResponse(actor, {
      author,
      isOrgEditor,
      requestStatus: meta.status,
      requestVisibility: meta.visibility,
      isInvited,
    })
  ) {
    return {
      ok: false,
      error:
        meta.status !== "active"
          ? "Na tuto poptávku už reagovat nelze."
          : "K reakci na tuto poptávku nemáte oprávnění.",
    };
  }

  const parsed = responseInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Neplatné údaje reakce.",
    };
  }

  const result = await createResponse({
    requestId,
    author,
    actorUserId: actor.userId,
    input: parsed.data,
  });
  if (!result.ok) {
    const messages: Record<typeof result.reason, string> = {
      request_not_found: "Poptávka nebyla nalezena.",
      duplicate: "Na tuto poptávku už jste reagovali.",
      invalid_portfolio_items:
        "Přiložit lze jen vlastní publikované portfolio projekty.",
    };
    return { ok: false, error: messages[result.reason] };
  }

  revalidatePath(`/poptavka/${requestId}`);
  revalidatePath(`/requests/${requestId}`);
  revalidatePath("/responses");
  return { ok: true };
}

/** Upraví reakci, dokud je `sent` (main flow bod 4). Autor only. */
export async function updateResponseAction(
  responseId: string,
  input: ResponseInput,
): Promise<ResponseActionResult> {
  const actor = await getActor();
  const current = await getResponseById(responseId);
  if (!current) return { ok: false, error: "Reakce nebyla nalezena." };

  const isOrgEditor = await resolveIsOrgEditor(actor, current.view.author);
  if (!canWriteResponse(actor, { author: current.view.author, isOrgEditor })) {
    return { ok: false, error: "K této reakci nemáte přístup." };
  }

  const parsed = responseInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Neplatné údaje reakce.",
    };
  }

  const result = await updateResponse(responseId, current.view.author, parsed.data);
  if (!result.ok) {
    const messages: Record<typeof result.reason, string> = {
      not_found: "Reakce nebyla nalezena.",
      not_editable: "Odeslanou reakci už takto upravit nelze.",
      invalid_portfolio_items:
        "Přiložit lze jen vlastní publikované portfolio projekty.",
    };
    return { ok: false, error: messages[result.reason] };
  }

  revalidatePath(`/poptavka/${current.view.requestId}`);
  revalidatePath(`/requests/${current.view.requestId}`);
  return { ok: true };
}

/** Stáhne reakci (main flow bod 3 — `sent`/`shortlisted` → `withdrawn`). Autor only. */
export async function withdrawResponseAction(
  responseId: string,
): Promise<ResponseActionResult> {
  const actor = await getActor();
  const current = await getResponseById(responseId);
  if (!current) return { ok: false, error: "Reakce nebyla nalezena." };

  const isOrgEditor = await resolveIsOrgEditor(actor, current.view.author);
  if (!canWriteResponse(actor, { author: current.view.author, isOrgEditor })) {
    return { ok: false, error: "K této reakci nemáte přístup." };
  }

  const result = await transitionResponse({
    responseId,
    action: "withdraw",
    actorUserId: actor.kind === "user" ? actor.userId : null,
  });
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.reason === "invalid_transition"
          ? "Reakci už v aktuálním stavu stáhnout nelze."
          : "Reakce nebyla nalezena.",
    };
  }

  revalidatePath(`/poptavka/${current.view.requestId}`);
  revalidatePath(`/requests/${current.view.requestId}`);
  revalidatePath("/responses");
  return { ok: true };
}

/** Zařadí reakci na užší seznam (main flow bod 5). Vlastník poptávky only. */
export async function shortlistResponseAction(
  responseId: string,
): Promise<ResponseActionResult> {
  return runOwnerTransition(responseId, "shortlist");
}

/** Přijme reakci — posune i poptávku do jednání (main flow bod 5). Vlastník only. */
export async function acceptResponseAction(
  responseId: string,
): Promise<ResponseActionResult> {
  return runOwnerTransition(responseId, "accept");
}

/** Odmítne reakci s volitelným důvodem (main flow bod 6). Vlastník poptávky only. */
export async function rejectResponseAction(
  responseId: string,
  input: ResponseRejectInput,
): Promise<ResponseActionResult> {
  const parsed = responseRejectSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Neplatný důvod odmítnutí." };
  }
  return runOwnerTransition(responseId, "reject", parsed.data.reason);
}

async function runOwnerTransition(
  responseId: string,
  action: "shortlist" | "accept" | "reject",
  rejectionReason?: string | null,
): Promise<ResponseActionResult> {
  const actor = await getActor();
  const current = await getResponseById(responseId);
  if (!current) return { ok: false, error: "Reakce nebyla nalezena." };

  if (!canManageResponse(actor, { requestOwnerUserId: current.requestOwnerUserId })) {
    return { ok: false, error: "K této reakci nemáte oprávnění." };
  }

  const result = await transitionResponse({
    responseId,
    action,
    actorUserId: actor.kind === "user" ? actor.userId : null,
    rejectionReason,
  });
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.reason === "invalid_transition"
          ? "Tento přechod v aktuálním stavu není možný."
          : "Reakce nebyla nalezena.",
    };
  }

  revalidatePath(`/requests/${current.view.requestId}`);
  revalidatePath(`/poptavka/${current.view.requestId}`);
  return { ok: true };
}
