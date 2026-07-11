import "server-only";

import { getActor } from "@/lib/session";
import { type Actor } from "@/lib/permissions";
import { roleAtLeast } from "@/features/organizations/rules";
import { getMembershipRole } from "@/features/organizations/service";
import {
  canEditPortfolio,
  canViewPortfolio,
  type PortfolioSubject,
} from "./permissions";
import { resolvePublicView, type PublicView } from "./public-view";
import {
  getCoauthorStatus,
  getProjectDetail,
  listConfirmedCoauthors,
  listCoauthorshipsForUser,
  listProjectsForUser,
  ownerRefOf,
  type PortfolioProjectDetail,
} from "./service";

/**
 * Čtecí vrstva portfolia (T012) pro stránky/akce. Vynucuje viditelnost draftu
 * (jen editoři a pozvaní spoluautoři) a sestavuje permission `subject` z DB.
 *
 * Firemní vlastnictví: role actora v organizaci se čte z modulu organizací
 * (T009) — členství → čtení draftu, editor+ → editace (matice T009).
 */

export type OrgMembership = { isMember: boolean; isEditor: boolean };

let orgMembershipResolver: (
  orgId: string,
  userId: string,
) => Promise<OrgMembership> = async (orgId, userId) => {
  const role = await getMembershipRole(orgId, userId);
  return { isMember: role !== null, isEditor: roleAtLeast(role, "editor") };
};

/** Testy si můžou zjištění firemní role actora podvrhnout. */
export function __setOrgMembershipResolver(
  resolver: (orgId: string, userId: string) => Promise<OrgMembership>,
): void {
  orgMembershipResolver = resolver;
}

/** Firemní role actora v organizaci (přes resolver, ať jde v testech podvrhnout). */
export function resolveOrgMembership(
  orgId: string,
  userId: string,
): Promise<OrgMembership> {
  return orgMembershipResolver(orgId, userId);
}

/**
 * Sestaví permission `subject` pro dané dílo a actora: doplní firemní roli
 * (u org-owned) a řádek spoluautora (pro čtení draftu). Čistě dohledá fakta z DB;
 * rozhodnutí dělá permission engine.
 */
async function resolveSubject(
  project: { ownerUserId: string | null; ownerOrgId: string | null; status: PortfolioSubject["status"] },
  actor: Actor,
  projectId: string,
): Promise<PortfolioSubject> {
  const owner = ownerRefOf(project);
  const subject: PortfolioSubject = { owner, status: project.status };

  if (actor.kind !== "user") return subject;

  if (owner.type === "organization") {
    const membership = await orgMembershipResolver(owner.orgId, actor.userId);
    subject.isOrgMember = membership.isMember;
    subject.isOrgEditor = membership.isEditor;
  }

  const coauthorStatus = await getCoauthorStatus(projectId, actor.userId);
  subject.isInvitedCoauthor = coauthorStatus !== null;

  return subject;
}

/** Projekty vlastněné přihlášeným uživatelem. Návštěvník → prázdný seznam. */
export async function listMyPortfolio() {
  const actor = await getActor();
  if (actor.kind !== "user") return [];
  return listProjectsForUser(actor.userId);
}

/** Spoluautorství přihlášeného uživatele (pozvání i potvrzená). */
export async function listMyCoauthorships() {
  const actor = await getActor();
  if (actor.kind !== "user") return [];
  return listCoauthorshipsForUser(actor.userId);
}

export type EditableProject = {
  project: PortfolioProjectDetail;
  subject: PortfolioSubject;
};

/**
 * Detail díla pro editaci. Vrátí `null`, pokud dílo neexistuje (nebo je smazané)
 * nebo na něj actor nemá editační právo.
 */
export async function getEditableProject(
  projectId: string,
): Promise<EditableProject | null> {
  const [actor, project] = await Promise.all([
    getActor(),
    getProjectDetail(projectId),
  ]);
  if (!project) return null;

  const subject = await resolveSubject(project, actor, projectId);
  if (!canEditPortfolio(actor, subject)) return null;
  return { project, subject };
}

export type ViewableProject = {
  project: PortfolioProjectDetail;
  view: PublicView;
  /** Potvrzení spoluautoři — čteni živě, ne ze snapshotu (odvolání souhlasu skryje). */
  confirmedCoauthors: Awaited<ReturnType<typeof listConfirmedCoauthors>>;
};

/**
 * Dílo pro (veřejné) zobrazení. Vynucuje viditelnost přes permission engine i
 * `resolvePublicView` (published veřejně; draft jen editor v náhledu). Vrátí
 * `null`, pokud dílo pro actora není viditelné. Metadata čte z projektu (veřejný
 * render T016 sáhne do snapshotu); spoluautory živě z potvrzených řádků.
 */
export async function getViewableProject(
  projectId: string,
  options: { preview?: boolean } = {},
): Promise<ViewableProject | null> {
  const [actor, project] = await Promise.all([
    getActor(),
    getProjectDetail(projectId),
  ]);
  if (!project) return null;

  const subject = await resolveSubject(project, actor, projectId);
  if (!canViewPortfolio(actor, subject)) return null;

  const isEditor = canEditPortfolio(actor, subject);
  const view = resolvePublicView({
    status: project.status,
    deleted: project.deletedAt !== null,
    // Owner-user aktivitu řeší veřejný render (T016); pro interní náhled stačí,
    // že actor je editor. Zde owner považujeme za aktivního (detail už filtruje
    // smazané projekty; deaktivaci účtu dořeší T016 join na User.status).
    ownerActive: true,
    isEditor,
    preview: options.preview === true,
  });
  if (!view.visible) return null;

  const confirmedCoauthors = await listConfirmedCoauthors(projectId);
  return { project, view, confirmedCoauthors };
}
