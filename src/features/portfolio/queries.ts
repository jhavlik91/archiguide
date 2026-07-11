import "server-only";

import { cache } from "react";
import { getActor } from "@/lib/session";
import { type Actor } from "@/lib/permissions";
import { roleAtLeast } from "@/features/organizations/rules";
import { getMembershipRole } from "@/features/organizations/service";
import {
  canEditPortfolio,
  canViewPortfolio,
  type PortfolioSubject,
} from "./permissions";
import {
  firstImageUrl,
  parsePortfolioBlocks,
  type PortfolioBlock,
} from "./blocks";
import {
  resolvePublicView,
  type PortfolioSnapshot,
  type PublicView,
} from "./public-view";
import {
  getCoauthorStatus,
  getProjectDetail,
  getPublicPortfolioBySlugOrId,
  listConfirmedCoauthors,
  listCoauthorshipsForUser,
  listProjectsForUser,
  listPublishedProjectsForOrg,
  listPublishedProjectsForUser,
  ownerRefOf,
  type PortfolioProjectDetail,
  type PublicPortfolioCardRow,
  type PublicPortfolioRow,
} from "./service";
import type { PortfolioProjectType } from "./types";

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
  project: {
    ownerUserId: string | null;
    ownerOrgId: string | null;
    status: PortfolioSubject["status"];
  },
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

// --- Veřejný render (T016) ---------------------------------------------------

/** Autor díla pro veřejné zobrazení: jméno + odkaz na profil (nebo `null`). */
export type PublicPortfolioAuthor = {
  name: string;
  /** Odkaz na veřejný profil (`/profesional/[slug]` | `/firma/[slug]`), nebo `null`. */
  href: string | null;
};

/** Dílo připravené k veřejnému renderu (metadata + bloky + autoři). */
export type PublicPortfolioProject = {
  id: string;
  slug: string | null;
  title: string;
  projectType: PortfolioProjectType | null;
  location: string | null;
  year: number | null;
  description: string | null;
  blocks: PortfolioBlock[];
  /** OG/cover obrázek (první obrázek napříč bloky), nebo `null`. */
  coverImageUrl: string | null;
  owner: PublicPortfolioAuthor;
  /** Potvrzení spoluautoři (živě z DB — odvolání souhlasu je hned skryje). */
  coauthors: PublicPortfolioAuthor[];
};

export type PublicPortfolioResult = {
  project: PublicPortfolioProject;
  view: Extract<PublicView, { visible: true }>;
  /** Je aktuální návštěvník editor díla? (náhledová lišta, vyřazení z analytiky). */
  isEditor: boolean;
};

/** Zobrazitelné jméno profesionála z jeho profilu (fallback, když chybí titulek). */
function professionalName(
  profile: { headline: string | null } | null,
  fallback: string,
): string {
  return profile?.headline?.trim() || fallback;
}

/** Odkaz na veřejný profil profesionála — jen když je publikovaný a má slug. */
function professionalHref(
  profile: { slug: string | null; status: string } | null,
): string | null {
  return profile && profile.status === "published" && profile.slug
    ? `/profesional/${profile.slug}`
    : null;
}

/**
 * Metadata + bloky pro render. Publikovaná verze čte ze snapshotu (zmražená);
 * náhled draftu čte z živých sloupců (co se právě chystá publikovat). Bloky se
 * berou ze snapshotu (jediný dostupný zdroj do zapojení T013).
 */
function resolveContent(
  row: PublicPortfolioRow,
  mode: "public" | "preview",
): Pick<
  PublicPortfolioProject,
  "title" | "projectType" | "location" | "year" | "description" | "blocks"
> {
  const snapshot = (row.publishedSnapshot as PortfolioSnapshot | null) ?? null;
  const blocks = parsePortfolioBlocks(snapshot?.contentBlocks);

  if (mode === "public" && snapshot) {
    return {
      title: snapshot.title,
      projectType: snapshot.projectType,
      location: snapshot.location,
      year: snapshot.year,
      description: snapshot.description,
      blocks,
    };
  }
  return {
    title: row.title,
    projectType: row.projectType,
    location: row.location,
    year: row.year,
    description: row.description,
    blocks,
  };
}

/** Sestaví autory (vlastník + potvrzení spoluautoři) z DB řádku. */
function resolveAuthors(row: PublicPortfolioRow): {
  owner: PublicPortfolioAuthor;
  coauthors: PublicPortfolioAuthor[];
} {
  const owner: PublicPortfolioAuthor = row.ownerOrg
    ? {
        name: row.ownerOrg.name,
        href: row.ownerOrg.slug ? `/firma/${row.ownerOrg.slug}` : null,
      }
    : {
        name: professionalName(
          row.ownerUser?.professionalProfile ?? null,
          "Profesionál",
        ),
        href: professionalHref(row.ownerUser?.professionalProfile ?? null),
      };

  const coauthors = row.coauthors.map((coauthor) => ({
    name: professionalName(coauthor.user.professionalProfile, "Spoluautor"),
    href: professionalHref(coauthor.user.professionalProfile),
  }));

  return { owner, coauthors };
}

/** Je vlastník díla aktivní? (deaktivace/archivace vlastníka dílo veřejně skryje). */
function ownerActiveOf(row: PublicPortfolioRow): boolean {
  return row.ownerOrg
    ? row.ownerOrg.status === "active"
    : row.ownerUser?.status === "active";
}

/**
 * Veřejné dílo podle slugu (nebo id pro náhled draftu) + jak se má vykreslit.
 * `null` = neexistuje nebo pro návštěvníka není viditelné → route dá 404.
 *
 * Memoizováno per-request (`cache`), aby `generateMetadata` i vlastní render
 * sáhly na DB jen jednou. Proto je `preview` poziční primitivní argument.
 */
export const getPublicPortfolioProject = cache(
  async (
    slugOrId: string,
    preview = false,
  ): Promise<PublicPortfolioResult | null> => {
    const [actor, row] = await Promise.all([
      getActor(),
      getPublicPortfolioBySlugOrId(slugOrId),
    ]);
    if (!row) return null;

    const subject = await resolveSubject(row, actor, row.id);
    if (!canViewPortfolio(actor, subject)) return null;

    const isEditor = canEditPortfolio(actor, subject);
    const view = resolvePublicView({
      status: row.status,
      deleted: false, // dotaz už smazané odfiltroval
      ownerActive: ownerActiveOf(row),
      isEditor,
      preview,
    });
    if (!view.visible) return null;

    const content = resolveContent(row, view.mode);
    const { owner, coauthors } = resolveAuthors(row);

    return {
      project: {
        id: row.id,
        slug: row.slug,
        ...content,
        coverImageUrl: firstImageUrl(content.blocks),
        owner,
        coauthors,
      },
      view,
      isEditor,
    };
  },
);

/** Kartička díla pro seznam na profilu/firmě. */
export type PublicPortfolioCard = {
  slug: string;
  title: string;
  projectType: PortfolioProjectType | null;
  year: number | null;
  coverImageUrl: string | null;
};

/** Zmapuje DB řádek na kartičku ze snapshotu; díla bez slugu (nezlistovatelná) vynechá. */
function toCard(row: PublicPortfolioCardRow): PublicPortfolioCard | null {
  if (!row.slug) return null;
  const snapshot = (row.publishedSnapshot as PortfolioSnapshot | null) ?? null;
  const blocks = parsePortfolioBlocks(snapshot?.contentBlocks);
  return {
    slug: row.slug,
    title: snapshot?.title ?? "",
    projectType: snapshot?.projectType ?? null,
    year: snapshot?.year ?? null,
    coverImageUrl: firstImageUrl(blocks),
  };
}

/** Publikované, veřejně listované projekty profesionála (pro seznam na profilu). */
export async function listPublicPortfolioForUser(
  userId: string,
): Promise<PublicPortfolioCard[]> {
  const rows = await listPublishedProjectsForUser(userId);
  return rows
    .map(toCard)
    .filter((card): card is PublicPortfolioCard => card !== null);
}

/** Publikované, veřejně listované projekty firmy (pro seznam na `/firma`). */
export async function listPublicPortfolioForOrg(
  orgId: string,
): Promise<PublicPortfolioCard[]> {
  const rows = await listPublishedProjectsForOrg(orgId);
  return rows
    .map(toCard)
    .filter((card): card is PublicPortfolioCard => card !== null);
}
