import "server-only";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { normalizeEmail } from "@/lib/email";
import { canPublish, coauthorResponseStatus } from "./rules";
import { buildSnapshot, type PortfolioContentBlock } from "./public-view";
import type { PortfolioOwnerRef } from "./permissions";
import type { UpdatePortfolioInput } from "./validation";

/**
 * Datová vrstva portfolia (T012). Jediné místo, které sahá na `db.portfolioProject`
 * a `db.portfolioCoauthor`. Invarianty (právě jeden vlastník, snapshot při
 * publikaci, měkké mazání, jedinečnost spoluautora) se vynucují tady na serveru;
 * oprávnění (kdo smí akci provést) řeší `actions.ts` přes permission vrstvu.
 */

// --- Seam na T013 (obsahové bloky) ------------------------------------------
//
// Publikace vyžaduje ≥1 blok obsahu (T012 § Validation, kontrola přes T013 API).
// T013 zatím není zmergeován, proto výchozí sonda hlásí „obsah je přítomný", ať
// jde publikační cyklus používat a testovat; T013 ji nahradí reálným počítáním
// bloků a zároveň dodá jejich obsah pro snapshot.

let contentBlockProbe: (projectId: string) => Promise<boolean> = async () => true;
let contentBlockProvider: (
  projectId: string,
) => Promise<PortfolioContentBlock[]> = async () => [];

/** T013 (a testy) zapojí reálnou detekci obsahu pro publikační gate. */
export function __setContentBlockProbe(
  probe: (projectId: string) => Promise<boolean>,
): void {
  contentBlockProbe = probe;
}

/** T013 (a testy) zapojí zdroj bloků pro pořízení snapshotu. */
export function __setContentBlockProvider(
  provider: (projectId: string) => Promise<PortfolioContentBlock[]>,
): void {
  contentBlockProvider = provider;
}

// --- Vlastník ---------------------------------------------------------------

/** Data sloupců vlastníka z polymorfního odkazu. */
function ownerColumns(owner: PortfolioOwnerRef) {
  return owner.type === "user"
    ? { ownerUserId: owner.userId, ownerOrgId: null }
    : { ownerUserId: null, ownerOrgId: owner.orgId };
}

/** Odvodí polymorfního vlastníka z uložených sloupců. */
export function ownerRefOf(project: {
  ownerUserId: string | null;
  ownerOrgId: string | null;
}): PortfolioOwnerRef {
  if (project.ownerUserId) {
    return { type: "user", userId: project.ownerUserId };
  }
  // CHECK v migraci zaručuje, že když není user, je vyplněná organizace.
  return { type: "organization", orgId: project.ownerOrgId! };
}

// --- Čtení ------------------------------------------------------------------

const detailInclude = {
  coauthors: {
    include: { user: { select: { id: true, email: true } } },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.PortfolioProjectInclude;

export type PortfolioProjectDetail = Prisma.PortfolioProjectGetPayload<{
  include: typeof detailInclude;
}>;

/** Projekt podle ID (bez spoluautorů). Smazané nevrací. */
export function getProjectById(projectId: string) {
  return db.portfolioProject.findFirst({
    where: { id: projectId, deletedAt: null },
  });
}

/** Projekt se spoluautory (i s jejich účty), nebo `null`. Smazané nevrací. */
export function getProjectDetail(
  projectId: string,
): Promise<PortfolioProjectDetail | null> {
  return db.portfolioProject.findFirst({
    where: { id: projectId, deletedAt: null },
    include: detailInclude,
  });
}

/** Projekty vlastněné uživatelem (nejnovější první). Bez smazaných. */
export function listProjectsForUser(userId: string) {
  return db.portfolioProject.findMany({
    where: { ownerUserId: userId, deletedAt: null },
    orderBy: { updatedAt: "desc" },
  });
}

/** Projekty vlastněné organizací (nejnovější první). Bez smazaných. */
export function listProjectsForOrg(orgId: string) {
  return db.portfolioProject.findMany({
    where: { ownerOrgId: orgId, deletedAt: null },
    orderBy: { updatedAt: "desc" },
  });
}

/** Stav spoluautora daného uživatele u projektu, nebo `null` (není spoluautor). */
export async function getCoauthorStatus(projectId: string, userId: string) {
  const row = await db.portfolioCoauthor.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { status: true },
  });
  return row?.status ?? null;
}

/** Potvrzení (veřejně zobrazitelní) spoluautoři projektu. */
export function listConfirmedCoauthors(projectId: string) {
  return db.portfolioCoauthor.findMany({
    where: { projectId, status: "confirmed" },
    include: { user: { select: { id: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
}

/** Projekty, kde je uživatel spoluautorem (pro „moje spoluautorství"). */
export function listCoauthorshipsForUser(userId: string) {
  return db.portfolioCoauthor.findMany({
    where: { userId, project: { deletedAt: null } },
    include: {
      project: { select: { id: true, title: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

// --- Založení a editace -----------------------------------------------------

/** Založí dílo s daným polymorfním vlastníkem (draft). */
export async function createProject(
  owner: PortfolioOwnerRef,
  title: string,
): Promise<{ id: string }> {
  const project = await db.portfolioProject.create({
    data: { ...ownerColumns(owner), title },
    select: { id: true },
  });
  return project;
}

/** Uloží metadata díla. */
export async function updateProjectMetadata(
  projectId: string,
  input: UpdatePortfolioInput,
): Promise<void> {
  await db.portfolioProject.update({
    where: { id: projectId },
    data: {
      title: input.title,
      projectType: input.projectType ?? null,
      location: input.location ?? null,
      year: input.year ?? null,
      description: input.description ?? null,
      visibility: input.visibility,
    },
  });
}

/** Měkce smaže projekt (nastaví `deletedAt`). Idempotentní. */
export async function softDeleteProject(projectId: string): Promise<void> {
  await db.portfolioProject.updateMany({
    where: { id: projectId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
}

// --- Publikační cyklus ------------------------------------------------------

export type PublishResult =
  | { ok: true }
  | { ok: false; error: "not_found" | "cannot_publish" };

/**
 * Publikuje projekt (draft → published): ověří podmínky (titul + ≥1 blok obsahu),
 * pořídí SNAPSHOT aktuálního obsahu a nastaví stav. `publishedAt` se nastaví jen
 * při první publikaci (přežije unpublish i další publikace). Nový snapshot
 * nahradí předchozí — dokud nová publikace neproběhne, veřejná verze drží starý.
 */
export async function publishProject(
  projectId: string,
): Promise<PublishResult> {
  const project = await db.portfolioProject.findFirst({
    where: { id: projectId, deletedAt: null },
    select: {
      title: true,
      projectType: true,
      location: true,
      year: true,
      description: true,
      visibility: true,
      publishedAt: true,
    },
  });
  if (!project) return { ok: false, error: "not_found" };

  const hasContent = await contentBlockProbe(projectId);
  if (!canPublish({ title: project.title, hasContent })) {
    return { ok: false, error: "cannot_publish" };
  }

  const contentBlocks = await contentBlockProvider(projectId);
  const snapshot = buildSnapshot({
    title: project.title,
    projectType: project.projectType,
    location: project.location,
    year: project.year,
    description: project.description,
    visibility: project.visibility,
    contentBlocks,
  });

  await db.portfolioProject.update({
    where: { id: projectId },
    data: {
      status: "published",
      publishedSnapshot: snapshot as unknown as Prisma.InputJsonValue,
      ...(project.publishedAt ? {} : { publishedAt: new Date() }),
    },
  });
  return { ok: true };
}

/**
 * Vrátí publikovaný projekt zpět do draftu (skryje veřejnou verzi). Snapshot se
 * ponechá — umožní pozdější náhled/obnovu a re-publikaci beze ztráty verze.
 */
export async function unpublishProject(projectId: string): Promise<void> {
  await db.portfolioProject.update({
    where: { id: projectId },
    data: { status: "draft" },
  });
}

// --- Spoluautoři ------------------------------------------------------------

export type InviteCoauthorResult =
  | { ok: true; coauthorUserId: string }
  | { ok: false; error: "user_not_found" | "is_owner" | "already_invited" };

/**
 * Pozve spoluautora podle e-mailu. Spoluautor musí mít účet (vazba je na userId).
 * Vlastníka-uživatele nelze pozvat jako spoluautora. Dřívější řádek (i `declined`)
 * se přepne zpět na `invited` (re-pozvání), aniž by vznikl duplikát.
 */
export async function inviteCoauthor(
  projectId: string,
  ownerUserId: string | null,
  email: string,
): Promise<InviteCoauthorResult> {
  const user = await db.user.findUnique({
    where: { email: normalizeEmail(email) },
    select: { id: true },
  });
  if (!user) return { ok: false, error: "user_not_found" };
  if (ownerUserId && user.id === ownerUserId) {
    return { ok: false, error: "is_owner" };
  }

  const existing = await db.portfolioCoauthor.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
    select: { status: true },
  });
  if (existing?.status === "invited" || existing?.status === "confirmed") {
    return { ok: false, error: "already_invited" };
  }

  await db.portfolioCoauthor.upsert({
    where: { projectId_userId: { projectId, userId: user.id } },
    create: { projectId, userId: user.id, status: "invited" },
    update: { status: "invited", respondedAt: null },
  });
  return { ok: true, coauthorUserId: user.id };
}

export type CoauthorResponseResult =
  | { ok: true }
  | { ok: false; error: "not_coauthor" };

/**
 * Reakce spoluautora na pozvání: `accept` → confirmed (zobrazí se), `decline` →
 * declined (zmizí z veřejné verze). Odvolání souhlasu je `decline` nad již
 * potvrzeným řádkem — projeví se okamžitě (spoluautoři se čtou živě, ne ze
 * snapshotu).
 */
export async function respondToCoauthorInvite(
  projectId: string,
  userId: string,
  response: "accept" | "decline",
): Promise<CoauthorResponseResult> {
  const existing = await db.portfolioCoauthor.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "not_coauthor" };

  await db.portfolioCoauthor.update({
    where: { projectId_userId: { projectId, userId } },
    data: { status: coauthorResponseStatus(response), respondedAt: new Date() },
  });
  return { ok: true };
}

/** Odebere spoluautora z projektu (zruší pozvání i uvedení). */
export async function removeCoauthor(
  projectId: string,
  userId: string,
): Promise<void> {
  await db.portfolioCoauthor.deleteMany({
    where: { projectId, userId },
  });
}
