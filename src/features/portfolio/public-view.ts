/**
 * Snapshot publikované verze a rozhodovací logika veřejného náhledu portfolia
 * (T012). Čistá vrstva (bez DB a `next/*`), aby šla pokrýt unit testy a sdílet
 * mezi service vrstvou (pořízení snapshotu při publikaci) a veřejným renderem
 * (T016). Veřejná verze čte METADATA/OBSAH ze snapshotu, ale spoluautory živě
 * z potvrzených řádků — odvolání souhlasu tak jméno hned skryje (zadani/16 §7).
 */

import type { PortfolioProjectType, PortfolioVisibility } from "./types";

/** Verze formátu snapshotu (kvůli budoucím migracím struktury z T013). */
export const SNAPSHOT_VERSION = 1;

/** Bloky obsahu vlastní T013; T012 je jen bez interpretace přenáší do snapshotu. */
export type PortfolioContentBlock = Record<string, unknown>;

/**
 * Zmražená publikovaná verze díla. Ukládá se do `portfolio_projects.publishedSnapshot`
 * při publikaci; veřejná verze z ní čte, takže pozdější úpravy draftu se venku
 * neprojeví do další publikace.
 */
export type PortfolioSnapshot = {
  version: number;
  title: string;
  projectType: PortfolioProjectType | null;
  location: string | null;
  year: number | null;
  description: string | null;
  visibility: PortfolioVisibility;
  /** Obsahové bloky v době publikace (zdroj T013; v T012 zpravidla prázdné). */
  contentBlocks: PortfolioContentBlock[];
  /** Kdy byl snapshot pořízen (čas publikace této verze). */
  snapshotAt: string;
};

/** Vstup pro pořízení snapshotu — aktuální (draftový) stav díla + jeho obsah. */
export type SnapshotSource = {
  title: string;
  projectType: PortfolioProjectType | null;
  location: string | null;
  year: number | null;
  description: string | null;
  visibility: PortfolioVisibility;
  contentBlocks: PortfolioContentBlock[];
};

/** Pořídí snapshot z aktuálního stavu díla (volá se při publikaci). */
export function buildSnapshot(
  source: SnapshotSource,
  now: Date = new Date(),
): PortfolioSnapshot {
  return {
    version: SNAPSHOT_VERSION,
    title: source.title,
    projectType: source.projectType,
    location: source.location,
    year: source.year,
    description: source.description,
    visibility: source.visibility,
    contentBlocks: source.contentBlocks,
    snapshotAt: now.toISOString(),
  };
}

export type PublicView =
  | { visible: true; mode: "public" | "preview" }
  | { visible: false };

/**
 * Jak (a zda) se má dílo veřejně vykreslit.
 *  - `published` a nesmazané → veřejné (i `unlisted`; listování řeší dohledatelnost).
 *  - `draft`/`archived` → jen editor v režimu náhledu (`?preview=1`).
 *  - smazané → nedostupné pro všechny.
 * Owner-user musí být aktivní (deaktivace/smazání účtu dílo skryje).
 */
export function resolvePublicView(input: {
  status: "draft" | "published" | "archived";
  deleted: boolean;
  ownerActive: boolean;
  isEditor: boolean;
  preview: boolean;
}): PublicView {
  if (input.deleted || !input.ownerActive) return { visible: false };
  if (input.status === "published") return { visible: true, mode: "public" };
  if (input.isEditor && input.preview) return { visible: true, mode: "preview" };
  return { visible: false };
}

/** Má se stránka indexovat? Jen veřejný (published) render. */
export function isIndexable(view: PublicView): boolean {
  return view.visible && view.mode === "public";
}
