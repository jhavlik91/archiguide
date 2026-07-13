import "server-only";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { trackEvent } from "@/lib/analytics";
import { getSession as getGuideSession } from "@/features/guide/service";
import type {
  GuideAnswers,
  GuideScenarioDefinition,
  GuideSessionAccessor,
} from "@/features/guide";
import {
  generateBriefContent,
  suggestBriefTitle,
  type GuideBriefSource,
} from "./generator";
import { parseBriefContent, serializeBriefContent } from "./content";
import type { BriefContent, BriefStatus, BriefView } from "./types";

/**
 * Datová vrstva briefu (T021). Jediné místo sahající na `db.brief`.
 *
 * Generuje brief z DOKONČENÉ guide session (T017–T020): načte náhled session přes
 * guide service (autorita nad vlastnictvím i výsledkem), čistý generátor z něj
 * složí `BriefContent` (§18) a ten se perzistuje jako SNAPSHOT.
 *
 * Invarianty vynucené tady:
 * - generovat lze jen z `completed` session patřící žadateli;
 * - nová položka je vždy `draft` + `private`;
 * - opětovné generování AKTUALIZUJE existující draft (žádné duplicity); sdílený
 *   brief se nepřepíše (revizi řeší T022);
 * - snapshot je nezávislý na session (smazání session brief neruší — FK SetNull).
 */

type BriefRow = Prisma.BriefGetPayload<Record<string, never>>;

/** Poskládá vstup generátoru z náhledu guide session (T020 už dodal `result`). */
function toSource(view: {
  scenarioSlug: string;
  scenarioName: string;
  version: number;
  visibleSteps: GuideBriefSource["def"]["steps"];
  answers: GuideAnswers;
  summary: GuideBriefSource["summary"];
  result?: GuideBriefSource["result"];
}): GuideBriefSource | null {
  if (!view.result) return null;
  const def: GuideScenarioDefinition = {
    slug: view.scenarioSlug,
    version: view.version,
    name: view.scenarioName,
    // Generátor formátuje jen zodpovězené (viditelné) kroky — `visibleSteps` stačí.
    steps: view.visibleSteps,
  };
  return {
    def,
    answers: view.answers,
    summary: view.summary,
    result: view.result,
  };
}

function toView(row: BriefRow): BriefView | null {
  const content = parseBriefContent(row.content);
  if (!content) return null;
  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
    guideSessionId: row.guideSessionId,
    scenarioSlug: row.scenarioSlug,
    title: row.title,
    status: row.status as BriefStatus,
    visibility: row.visibility as BriefView["visibility"],
    content,
    generatedAt: row.generatedAt.toISOString(),
  };
}

// --- Generování z session ---------------------------------------------------

export type GenerateBriefResult =
  | { ok: true; view: BriefView; created: boolean }
  | {
      ok: false;
      reason:
        | "session_not_found"
        | "forbidden"
        | "not_completed"
        | "no_result"
        | "corrupt";
    };

/**
 * Vygeneruje (nebo přegeneruje) brief z dokončené guide session pro daného
 * vlastníka. Idempotentní vůči session: existující DRAFT aktualizuje, nikdy
 * nezakládá duplicitu. Sdílený brief (mimo `draft`) se nepřepisuje.
 */
export async function generateBriefFromSession(params: {
  sessionId: string;
  ownerUserId: string;
  guideAccessor: GuideSessionAccessor;
}): Promise<GenerateBriefResult> {
  const session = await getGuideSession(params.sessionId, params.guideAccessor);
  if (!session.ok) {
    return {
      ok: false,
      reason:
        session.reason === "forbidden" ? "forbidden" : "session_not_found",
    };
  }
  const view = session.view;
  // Validation: session musí být `completed` (T021 § Preconditions/Validation).
  if (view.state !== "completed") return { ok: false, reason: "not_completed" };

  const source = toSource(view);
  if (!source) return { ok: false, reason: "no_result" };

  const content = generateBriefContent(source);
  const title = suggestBriefTitle(source);
  const serialized = serializeBriefContent(content);

  // Idempotence: nejnovější brief z téže session pro téhož vlastníka.
  const existing = await db.brief.findFirst({
    where: {
      guideSessionId: params.sessionId,
      ownerUserId: params.ownerUserId,
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    // Sdílený/revidovaný brief se NEPŘEPÍŠE — přegenerování by přepsalo rozeslaný
    // obsah (zadani/09 — Brief; revizi řeší T022). Vrátíme ho beze změny, aby na
    // něj CTA jen navigovalo.
    if (existing.status !== "draft") {
      return finalize(existing, false);
    }
    const updated = await db.brief.update({
      where: { id: existing.id },
      data: {
        title,
        content: serialized as unknown as Prisma.InputJsonValue,
        scenarioSlug: view.scenarioSlug,
        generatedAt: new Date(),
      },
    });
    trackEvent("brief.regenerated", {
      briefId: updated.id,
      sessionId: params.sessionId,
    });
    return finalize(updated, false);
  }

  const created = await db.brief.create({
    data: {
      ownerUserId: params.ownerUserId,
      guideSessionId: params.sessionId,
      scenarioSlug: view.scenarioSlug,
      title,
      content: serialized as unknown as Prisma.InputJsonValue,
      status: "draft",
      visibility: "private",
    },
  });
  trackEvent("brief.created", {
    briefId: created.id,
    sessionId: params.sessionId,
    scenarioSlug: view.scenarioSlug,
  });
  return finalize(created, true);
}

function finalize(row: BriefRow, created: boolean): GenerateBriefResult {
  const view = toView(row);
  if (!view) return { ok: false, reason: "corrupt" };
  return { ok: true, view, created };
}

// --- Čtení / stavy ----------------------------------------------------------

export type GetBriefResult =
  | { ok: true; view: BriefView }
  | { ok: false; reason: "not_found" | "corrupt" };

/** Načte brief (bez kontroly oprávnění — tu dělá volající přes `canReadBrief`). */
export async function getBriefById(briefId: string): Promise<GetBriefResult> {
  const row = await db.brief.findUnique({ where: { id: briefId } });
  if (!row) return { ok: false, reason: "not_found" };
  const view = toView(row);
  if (!view) return { ok: false, reason: "corrupt" };
  return { ok: true, view };
}

export type MarkReadyResult =
  | { ok: true; view: BriefView }
  | { ok: false; reason: "not_found" | "invalid_transition" | "corrupt" };

/**
 * Přechod `draft → ready` (zadani/08 §2). Idempotentní pro `ready`. Ostatní stavy
 * (`shared`/`revised`/`archived`) jsou mimo scope T021 (řeší T022) — vrací
 * `invalid_transition`. Kontrolu vlastnictví dělá volající (`canWriteBrief`).
 */
export async function markBriefReady(
  briefId: string,
): Promise<MarkReadyResult> {
  const row = await db.brief.findUnique({ where: { id: briefId } });
  if (!row) return { ok: false, reason: "not_found" };
  if (row.status === "ready") {
    const view = toView(row);
    return view ? { ok: true, view } : { ok: false, reason: "corrupt" };
  }
  if (row.status !== "draft") {
    return { ok: false, reason: "invalid_transition" };
  }
  const updated = await db.brief.update({
    where: { id: briefId },
    data: { status: "ready" },
  });
  trackEvent("brief.ready", { briefId });
  const view = toView(updated);
  return view ? { ok: true, view } : { ok: false, reason: "corrupt" };
}

/** Stručná položka pro přehled briefů (dashboard). */
export interface BriefListItem {
  id: string;
  title: string;
  status: BriefStatus;
  scenarioSlug: string;
  updatedAt: string;
}

/** Briefy vlastníka, nejnovější první. */
export async function listBriefsForUser(
  ownerUserId: string,
): Promise<BriefListItem[]> {
  const rows = await db.brief.findMany({
    where: { ownerUserId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      scenarioSlug: true,
      updatedAt: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status as BriefStatus,
    scenarioSlug: r.scenarioSlug,
    updatedAt: r.updatedAt.toISOString(),
  }));
}

// Reexport typu pro pohodlí volajících akcí.
export type { BriefContent };
