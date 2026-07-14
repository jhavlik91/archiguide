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
import { registerContextResolver } from "@/lib/attachments";
import { isUser } from "@/lib/permissions";
import {
  generateBriefContent,
  suggestBriefTitle,
  type GuideBriefSource,
} from "./generator";
import {
  applyBriefEdit,
  parseBriefContent,
  redactBriefPrivate,
  serializeBriefContent,
  type BriefEditInput,
} from "./content";
import {
  isArchivableFrom,
  isShareableFrom,
  statusAfterEdit,
} from "./transitions";
import { createShareToken } from "./tokens";
import type {
  BriefContent,
  BriefStatus,
  BriefView,
  SharedBriefView,
} from "./types";

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
  const status = row.status as BriefStatus;
  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
    guideSessionId: row.guideSessionId,
    scenarioSlug: row.scenarioSlug,
    title: row.title,
    status,
    visibility: row.visibility as BriefView["visibility"],
    content,
    generatedAt: row.generatedAt.toISOString(),
    shareToken: row.shareToken,
    sharedAt: row.sharedAt?.toISOString() ?? null,
    shareRevokedAt: row.shareRevokedAt?.toISOString() ?? null,
    hasUnsharedChanges: status === "revised",
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

// --- Editace obsahu (T022) --------------------------------------------------

export type UpdateBriefResult =
  | { ok: true; view: BriefView }
  | { ok: false; reason: "not_found" | "corrupt" | "archived" };

/**
 * Uloží manuální úpravu obsahu §18 (T022 § Main flow 1). Odvozená pole zachová
 * (`applyBriefEdit`); editace SDÍLENÉHO briefu ho posune `shared → revised`
 * (živý obsah se rozešel se snapshotem u příjemců). Archivovaný brief se needituje.
 * Kontrolu vlastnictví dělá volající (`canWriteBrief`).
 */
export async function updateBriefContent(
  briefId: string,
  input: BriefEditInput,
): Promise<UpdateBriefResult> {
  const row = await db.brief.findUnique({ where: { id: briefId } });
  if (!row) return { ok: false, reason: "not_found" };
  if (row.status === "archived") return { ok: false, reason: "archived" };
  const existing = parseBriefContent(row.content);
  if (!existing) return { ok: false, reason: "corrupt" };

  const nextContent = applyBriefEdit(existing, input);
  const serialized = serializeBriefContent(nextContent);
  const nextStatus = statusAfterEdit(row.status as BriefStatus);

  const updated = await db.brief.update({
    where: { id: briefId },
    data: {
      title: input.title,
      content: serialized as unknown as Prisma.InputJsonValue,
      status: nextStatus,
    },
  });
  trackEvent("brief.edited", { briefId, status: nextStatus });
  const view = toView(updated);
  return view ? { ok: true, view } : { ok: false, reason: "corrupt" };
}

// --- Sdílení / odvolání (T022) ----------------------------------------------

export type ShareBriefResult =
  | { ok: true; view: BriefView; token: string; reshared: boolean }
  | { ok: false; reason: "not_found" | "corrupt" | "not_shareable" };

/**
 * (Znovu)sdílí brief privátním odkazem (T022 § Main flow 3–4). ZMRAZÍ aktuální
 * živý obsah do `sharedContent` (příjemci vidí jen tento snapshot), nastaví
 * `shared`/`shared_link` a vrátí plaintext token. Opětovné sdílení (po úpravě =
 * `revised`, nebo po odvolání) obnoví snapshot; stejný aktivní odkaz podruhé
 * nesdílí (no-op). Archivovaný brief sdílet nelze.
 */
export async function shareBrief(briefId: string): Promise<ShareBriefResult> {
  const row = await db.brief.findUnique({ where: { id: briefId } });
  if (!row) return { ok: false, reason: "not_found" };
  const status = row.status as BriefStatus;

  // Už aktivně sdílený a beze změny → vrátíme stávající odkaz (idempotence).
  if (row.shareToken && status === "shared") {
    const view = toView(row);
    return view
      ? { ok: true, view, token: row.shareToken, reshared: false }
      : { ok: false, reason: "corrupt" };
  }
  if (status === "archived") return { ok: false, reason: "not_shareable" };
  if (!row.shareToken && !isShareableFrom(status)) {
    return { ok: false, reason: "not_shareable" };
  }

  if (!parseBriefContent(row.content)) return { ok: false, reason: "corrupt" };

  const token = row.shareToken ?? createShareToken();
  const reshared = row.sharedAt !== null;
  const updated = await db.brief.update({
    where: { id: briefId },
    data: {
      shareToken: token,
      // Zmrazíme aktuální živý obsah jako snapshot pro příjemce.
      sharedContent: row.content as Prisma.InputJsonValue,
      sharedTitle: row.title,
      sharedAt: new Date(),
      shareRevokedAt: null,
      status: "shared",
      visibility: "shared_link",
    },
  });
  trackEvent("brief.shared", { briefId, reshared });
  const view = toView(updated);
  return view
    ? { ok: true, view, token, reshared }
    : { ok: false, reason: "corrupt" };
}

export type RevokeShareResult =
  | { ok: true; view: BriefView }
  | { ok: false; reason: "not_found" | "corrupt" | "not_shared" };

/**
 * Odvolá sdílený odkaz (T022 § Alternative flows). Token se vynuluje → sdílená
 * stránka OKAMŽITĚ vrací „odkaz již není platný". Brief se vrací do `ready`
 * (soukromý, připravený znovu sdílet). Idempotentní vůči nesdílenému briefu není
 * — ten nemá co odvolat (`not_shared`).
 */
export async function revokeShare(briefId: string): Promise<RevokeShareResult> {
  const row = await db.brief.findUnique({ where: { id: briefId } });
  if (!row) return { ok: false, reason: "not_found" };
  if (!row.shareToken) return { ok: false, reason: "not_shared" };
  const updated = await db.brief.update({
    where: { id: briefId },
    data: {
      shareToken: null,
      shareRevokedAt: new Date(),
      status: "ready",
      visibility: "private",
    },
  });
  trackEvent("brief.share_revoked", { briefId });
  const view = toView(updated);
  return view ? { ok: true, view } : { ok: false, reason: "corrupt" };
}

// --- Archivace (T022) -------------------------------------------------------

export type ArchiveBriefResult =
  | { ok: true; view: BriefView }
  | { ok: false; reason: "not_found" | "corrupt" | "invalid_transition" };

/** Archivuje brief (`draft → archived`, zadani/08 §2). Vlastník only. */
export async function archiveBrief(
  briefId: string,
): Promise<ArchiveBriefResult> {
  const row = await db.brief.findUnique({ where: { id: briefId } });
  if (!row) return { ok: false, reason: "not_found" };
  if (!isArchivableFrom(row.status as BriefStatus)) {
    return { ok: false, reason: "invalid_transition" };
  }
  const updated = await db.brief.update({
    where: { id: briefId },
    data: { status: "archived", shareToken: null, visibility: "private" },
  });
  trackEvent("brief.archived", { briefId });
  const view = toView(updated);
  return view ? { ok: true, view } : { ok: false, reason: "corrupt" };
}

// --- Čtení sdíleného snapshotu (anonymně přes token) ------------------------

/**
 * Načte READ-ONLY snapshot sdíleného briefu podle tokenu (T022 § Main flow 3).
 * Vrací `null` pro neznámý/odvolaný token (`shareToken` je pak `null`, unikátní
 * lookup nic nenajde) — sdílená stránka zobrazí „odkaz již není platný". Snapshot
 * je REDIGOVANÝ (bez přesné adresy); token ani vlastníka nevydává.
 */
export async function getBriefBySharedToken(
  token: string,
): Promise<SharedBriefView | null> {
  if (!token) return null;
  const row = await db.brief.findUnique({ where: { shareToken: token } });
  if (!row || !row.sharedContent || !row.sharedAt) return null;
  const snapshot = parseBriefContent(row.sharedContent);
  if (!snapshot) return null;
  return {
    title: row.sharedTitle ?? row.title,
    content: redactBriefPrivate(snapshot),
    scenarioSlug: row.scenarioSlug,
    sharedAt: row.sharedAt.toISOString(),
  };
}

// --- Attachment kontext (T022 × T023) ---------------------------------------
//
// Brief registruje resolver svého kontextu, aby šly přikládat dokumenty přes
// sdílený systém příloh (`@/lib/attachments`). Kontext existuje, pokud brief
// existuje; ÚČASTNÍKEM je jen vlastník (brief je soukromá data) — nikdo jiný
// tedy do něj nepřiloží ani neuvidí `shared_in_context` přílohy. Side-effect
// import ze service; opětovná registrace je idempotentní (HMR-safe).
registerContextResolver("brief", async (contextId, actor) => {
  const brief = await db.brief.findUnique({
    where: { id: contextId },
    select: { ownerUserId: true },
  });
  if (!brief) return { exists: false, isParticipant: false };
  return {
    exists: true,
    isParticipant: isUser(actor) && actor.userId === brief.ownerUserId,
  };
});

// Reexport typu pro pohodlí volajících akcí.
export type { BriefContent };
