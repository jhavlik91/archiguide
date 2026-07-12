import "server-only";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { registerMediaUsageResolver, type MediaUsage } from "@/features/media/usage";
import {
  blockAssetIds,
  isPortfolioBlockKind,
  parsePortfolioBlocks,
  type DraftPortfolioBlock,
} from "./blocks";
import {
  __setContentBlockProbe,
  __setContentBlockProvider,
} from "./service";
import type { PortfolioContentBlock } from "./public-view";

/**
 * Datová vrstva obsahových bloků portfolia (T013). Jediné místo, které sahá na
 * `db.portfolioBlock`. Bloky patří DRAFT verzi díla; ukládání je „nahraď vše"
 * v transakci — editor pošle celý dokument, server řádky přepíše a zvýší
 * `blocksVersion` (detekce souběžné editace). Publikace (T012) je zvaliduje strict
 * a zmrazí do snapshotu.
 *
 * Modul zároveň zapojuje dva seamy z okolních domén:
 *  - do `service.ts` doplní reálnou detekci obsahu pro publikační gate + zdroj
 *    bloků pro snapshot (dosud jen zástupné funkce),
 *  - do médií (T014) registruje resolver „kde je asset použitý" (blok mazání a
 *    veřejné servírování derivátu).
 * Registrace běží jednou při načtení modulu (viz `src/instrumentation.ts`).
 */

// --- Čtení ------------------------------------------------------------------

/** Draftové bloky díla (seřazené) + verze, proti které editor pracuje. */
export async function listDraftBlocks(
  projectId: string,
): Promise<{ blocks: DraftPortfolioBlock[]; version: number }> {
  const [project, rows] = await Promise.all([
    db.portfolioProject.findUnique({
      where: { id: projectId },
      select: { blocksVersion: true },
    }),
    db.portfolioBlock.findMany({
      where: { projectId },
      orderBy: { order: "asc" },
      select: { type: true, content: true },
    }),
  ]);

  const blocks: DraftPortfolioBlock[] = [];
  for (const row of rows) {
    // Neznámý typ (např. z novější verze editoru) do UI nepropustíme.
    if (isPortfolioBlockKind(row.type)) {
      blocks.push({ type: row.type, content: row.content });
    }
  }
  return { blocks, version: project?.blocksVersion ?? 0 };
}

// --- Ukládání ---------------------------------------------------------------

export type SaveDraftBlocksResult = { version: number; conflict: boolean };

/**
 * Přepíše všechny draftové bloky díla (autosave). V transakci: přečte aktuální
 * verzi (souběh = `baseVersion` se liší → `conflict`, ale ukládá se dál —
 * last-write-wins), smaže staré řádky, založí nové v daném pořadí a zvýší verzi.
 * `updatedAt` díla se dotkne, aby seznam portfolia řadil naposledy upravené první.
 */
export async function saveDraftBlocks(
  projectId: string,
  baseVersion: number,
  blocks: DraftPortfolioBlock[],
): Promise<SaveDraftBlocksResult> {
  return db.$transaction(async (tx) => {
    const project = await tx.portfolioProject.findUnique({
      where: { id: projectId },
      select: { blocksVersion: true },
    });
    const current = project?.blocksVersion ?? 0;
    const conflict = baseVersion !== current;

    await tx.portfolioBlock.deleteMany({ where: { projectId } });
    if (blocks.length > 0) {
      await tx.portfolioBlock.createMany({
        data: blocks.map((block, index) => ({
          projectId,
          type: block.type,
          order: index,
          content: block.content as Prisma.InputJsonValue,
        })),
      });
    }

    const nextVersion = current + 1;
    await tx.portfolioProject.update({
      where: { id: projectId },
      data: { blocksVersion: nextVersion, updatedAt: new Date() },
    });

    return { version: nextVersion, conflict };
  });
}

// --- Publikační seam (do service.ts) ----------------------------------------

/**
 * Publikovatelné bloky díla pro snapshot: draftové bloky projeté strict schématem
 * (`parsePortfolioBlocks`). Neúplné/nevalidní se vynechají — do veřejné verze jde
 * jen to, co se dá bezpečně vykreslit.
 */
async function getPublishableContentBlocks(
  projectId: string,
): Promise<PortfolioContentBlock[]> {
  const rows = await db.portfolioBlock.findMany({
    where: { projectId },
    orderBy: { order: "asc" },
    select: { type: true, content: true },
  });
  const valid = parsePortfolioBlocks(
    rows.map((row) => ({ type: row.type, content: row.content })),
  );
  return valid as unknown as PortfolioContentBlock[];
}

/** Má dílo aspoň jeden publikovatelný blok? (publikační gate T012 § Validation). */
async function hasPublishableBlocks(projectId: string): Promise<boolean> {
  const blocks = await getPublishableContentBlocks(projectId);
  return blocks.length > 0;
}

// --- Media usage seam (T014) ------------------------------------------------

type SnapshotShape = { contentBlocks?: unknown };

/** Obsahuje snapshot (publikovaná verze) odkaz na daný asset? */
function snapshotUsesAsset(snapshot: unknown, assetId: string): boolean {
  const blocks = (snapshot as SnapshotShape | null)?.contentBlocks;
  if (!Array.isArray(blocks)) return false;
  return blocks.some((block) => {
    if (!block || typeof block !== "object") return false;
    const b = block as { type?: unknown; content?: unknown };
    return (
      typeof b.type === "string" &&
      blockAssetIds({ type: b.type, content: b.content }).includes(assetId)
    );
  });
}

/**
 * Kde je media asset použitý v portfoliu (T014 media usage seam). Publikované
 * použití (v snapshotu) blokuje mazání a povoluje veřejné servírování derivátu;
 * použití jen v draftu je „published: false" (měkké smazání projde s varováním).
 * Na projekt vrací nejvýš jedno použití — publikované má přednost.
 */
async function resolvePortfolioMediaUsage(
  assetId: string,
): Promise<MediaUsage[]> {
  const projects = await db.portfolioProject.findMany({
    where: { deletedAt: null },
    select: {
      title: true,
      slug: true,
      status: true,
      publishedSnapshot: true,
      blocks: {
        where: { type: { in: ["image", "gallery", "before_after"] } },
        select: { type: true, content: true },
      },
    },
  });

  const usages: MediaUsage[] = [];
  for (const project of projects) {
    const inSnapshot =
      project.status === "published" &&
      snapshotUsesAsset(project.publishedSnapshot, assetId);
    const inDraft = project.blocks.some((block) =>
      blockAssetIds(block).includes(assetId),
    );
    if (!inSnapshot && !inDraft) continue;

    if (inSnapshot) {
      usages.push({
        label: `Portfolio: ${project.title}`,
        href: project.slug ? `/projekt/${project.slug}` : undefined,
        published: true,
      });
    } else {
      usages.push({
        label: `Portfolio (koncept): ${project.title}`,
        published: false,
      });
    }
  }
  return usages;
}

// --- Registrace seamů (jednou za proces) ------------------------------------

const REGISTERED = Symbol.for("archiguide.portfolio.blocksSeamsRegistered");
type SeamGlobal = typeof globalThis & { [REGISTERED]?: boolean };

if (!(globalThis as SeamGlobal)[REGISTERED]) {
  (globalThis as SeamGlobal)[REGISTERED] = true;
  __setContentBlockProbe(hasPublishableBlocks);
  __setContentBlockProvider(getPublishableContentBlocks);
  registerMediaUsageResolver(resolvePortfolioMediaUsage);
}
