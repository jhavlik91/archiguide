"use server";

import { revalidatePath } from "next/cache";
import { getActor } from "@/lib/session";
import { trackEvent } from "@/lib/analytics";
// Import zároveň registruje oprávnění portfolia (portfolio.create/edit/…).
import {
  canCreatePortfolio,
  type PortfolioCreateSubject,
  type PortfolioOwnerRef,
} from "./permissions";
import { getEditableProject, resolveOrgMembership } from "./queries";
import {
  createProject,
  getCoauthorStatus,
  inviteCoauthor,
  publishProject,
  respondToCoauthorInvite,
  softDeleteProject,
  unpublishProject,
  updateProjectMetadata,
} from "./service";
import {
  coauthorResponseSchema,
  createPortfolioSchema,
  inviteCoauthorSchema,
  projectTargetSchema,
  updatePortfolioSchema,
} from "./validation";

/**
 * Server akce portfolia (T012). Každá akce ověří oprávnění přes permission
 * vrstvu (datové fakty dodá čtecí vrstva) a teprve pak volá service. Chyby se
 * vrací jako výsledek (bez vyhození), aby je formuláře uměly zobrazit.
 */

export type PortfolioActionResult =
  | { ok: true; projectId?: string }
  | {
      ok: false;
      error: "unauthenticated" | "forbidden" | "validation" | "not_found" | "rule";
      message: string;
    };

const UNAUTHENTICATED: PortfolioActionResult = {
  ok: false,
  error: "unauthenticated",
  message: "Přihlaste se prosím.",
};
const FORBIDDEN: PortfolioActionResult = {
  ok: false,
  error: "forbidden",
  message: "K této akci nemáte oprávnění.",
};
const NOT_FOUND: PortfolioActionResult = {
  ok: false,
  error: "not_found",
  message: "Dílo nebylo nalezeno.",
};

function invalid(message = "Zkontrolujte zadané údaje."): PortfolioActionResult {
  return { ok: false, error: "validation", message };
}
function ruleError(message: string): PortfolioActionResult {
  return { ok: false, error: "rule", message };
}

function revalidatePortfolio(projectId?: string): void {
  revalidatePath("/portfolio");
  if (projectId) revalidatePath(`/portfolio/${projectId}`);
}

// --- Založení ---------------------------------------------------------------

/**
 * Založí portfolio dílo. Bez `ownerOrgId` vzniká dílo vlastněné uživatelem
 * (profesionálem); s `ownerOrgId` firemní dílo (vyžaduje org editor+).
 */
export async function createPortfolioProject(
  input: unknown,
): Promise<PortfolioActionResult> {
  const actor = await getActor();
  if (actor.kind !== "user") return UNAUTHENTICATED;

  const parsed = createPortfolioSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message);

  const owner: PortfolioOwnerRef = parsed.data.ownerOrgId
    ? { type: "organization", orgId: parsed.data.ownerOrgId }
    : { type: "user", userId: actor.userId };

  const subject: PortfolioCreateSubject = { owner };
  if (owner.type === "organization") {
    const membership = await resolveOrgMembership(owner.orgId, actor.userId);
    subject.isOrgEditor = membership.isEditor;
  }
  if (!canCreatePortfolio(actor, subject)) return FORBIDDEN;

  const { id } = await createProject(owner, parsed.data.title);
  trackEvent("portfolio.created", {
    userId: actor.userId,
    projectId: id,
    ownerType: owner.type,
  });
  revalidatePortfolio(id);
  return { ok: true, projectId: id };
}

// --- Editace / mazání -------------------------------------------------------

export async function savePortfolioMetadata(
  projectId: string,
  input: unknown,
): Promise<PortfolioActionResult> {
  const actor = await getActor();
  if (actor.kind !== "user") return UNAUTHENTICATED;

  const parsed = updatePortfolioSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message);

  // getEditableProject vrací null u neexistujícího i nedostupného díla —
  // abychom neprozradili existenci cizího draftu, hlásíme „nenalezeno".
  const editable = await getEditableProject(projectId);
  if (!editable) return NOT_FOUND;

  await updateProjectMetadata(projectId, parsed.data);
  revalidatePortfolio(projectId);
  return { ok: true, projectId };
}

export async function deletePortfolioProject(
  input: unknown,
): Promise<PortfolioActionResult> {
  const actor = await getActor();
  if (actor.kind !== "user") return UNAUTHENTICATED;

  const parsed = projectTargetSchema.safeParse(input);
  if (!parsed.success) return invalid();

  const editable = await getEditableProject(parsed.data.projectId);
  if (!editable) return NOT_FOUND;

  await softDeleteProject(parsed.data.projectId);
  revalidatePortfolio(parsed.data.projectId);
  return { ok: true };
}

// --- Publikační cyklus ------------------------------------------------------

export async function publishPortfolioProject(
  input: unknown,
): Promise<PortfolioActionResult> {
  const actor = await getActor();
  if (actor.kind !== "user") return UNAUTHENTICATED;

  const parsed = projectTargetSchema.safeParse(input);
  if (!parsed.success) return invalid();

  const editable = await getEditableProject(parsed.data.projectId);
  if (!editable) return NOT_FOUND;

  const result = await publishProject(parsed.data.projectId);
  if (!result.ok) {
    if (result.error === "not_found") return NOT_FOUND;
    return ruleError(
      "Dílo nelze publikovat — vyplňte název a přidejte alespoň jeden blok obsahu.",
    );
  }

  trackEvent("portfolio.published", {
    userId: actor.userId,
    projectId: parsed.data.projectId,
  });
  revalidatePortfolio(parsed.data.projectId);
  return { ok: true, projectId: parsed.data.projectId };
}

export async function unpublishPortfolioProject(
  input: unknown,
): Promise<PortfolioActionResult> {
  const actor = await getActor();
  if (actor.kind !== "user") return UNAUTHENTICATED;

  const parsed = projectTargetSchema.safeParse(input);
  if (!parsed.success) return invalid();

  const editable = await getEditableProject(parsed.data.projectId);
  if (!editable) return NOT_FOUND;

  await unpublishProject(parsed.data.projectId);
  revalidatePortfolio(parsed.data.projectId);
  return { ok: true, projectId: parsed.data.projectId };
}

// --- Spoluautoři ------------------------------------------------------------

export async function invitePortfolioCoauthor(
  projectId: string,
  input: unknown,
): Promise<PortfolioActionResult> {
  const actor = await getActor();
  if (actor.kind !== "user") return UNAUTHENTICATED;

  const parsed = inviteCoauthorSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message);

  const editable = await getEditableProject(projectId);
  if (!editable) return NOT_FOUND;

  const result = await inviteCoauthor(
    projectId,
    editable.subject.owner.type === "user"
      ? editable.subject.owner.userId
      : null,
    parsed.data.email,
  );
  if (!result.ok) {
    if (result.error === "user_not_found") {
      return ruleError("Uživatel s tímto e-mailem nemá účet.");
    }
    if (result.error === "is_owner") {
      return ruleError("Vlastníka nelze pozvat jako spoluautora.");
    }
    return ruleError("Tento spoluautor už je pozvaný.");
  }
  revalidatePortfolio(projectId);
  return { ok: true, projectId };
}

/**
 * Reakce přihlášeného spoluautora na pozvání (potvrzení/odmítnutí, i odvolání
 * souhlasu). Guard je vlastnictví ŘÁDKU spoluautora — reaguje jen sám pozvaný,
 * ne editor díla.
 */
export async function respondToCoauthorInvitation(
  input: unknown,
): Promise<PortfolioActionResult> {
  const actor = await getActor();
  if (actor.kind !== "user") return UNAUTHENTICATED;

  const parsed = coauthorResponseSchema.safeParse(input);
  if (!parsed.success) return invalid();

  const status = await getCoauthorStatus(parsed.data.projectId, actor.userId);
  if (status === null) return FORBIDDEN;

  const result = await respondToCoauthorInvite(
    parsed.data.projectId,
    actor.userId,
    parsed.data.response,
  );
  if (!result.ok) return NOT_FOUND;
  revalidatePortfolio(parsed.data.projectId);
  return { ok: true, projectId: parsed.data.projectId };
}
