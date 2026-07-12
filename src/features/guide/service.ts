import "server-only";

import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { trackEvent } from "@/lib/analytics";
import { applyAnswer, getSummary, resolveGuide } from "./engine";
import { validateAnswer } from "./validation";
import { canAccessSession, type GuideSessionAccessor } from "./permissions";
import type {
  GuideAnswer,
  GuideAnswers,
  GuideConflictRule,
  GuideScenarioDefinition,
  GuideStepDefinition,
  GuideStepType,
  GuideSummary,
} from "./types";

/**
 * Datová vrstva guide (T017). Jediné místo sahající na `db.guideScenario`,
 * `db.guideStep` a `db.guideSession`. Engine (čistý) načte definici scénáře z DB,
 * spočítá další krok / shrnutí a výsledek se tu perzistuje.
 *
 * Invarianty vynucené tady:
 * - odpovídat lze jen na VIDITELNÝ krok platnou hodnotou (engine + `validateAnswer`);
 * - session čte/píše jen vlastník (`canAccessSession`);
 * - běžící session dokončí SVOU verzi scénáře (drží FK na konkrétní řádek verze);
 * - anonymní session se po přihlášení připojí k účtu (`attachSessionsToUser`).
 */

// --- Serializace answers / conflicts ----------------------------------------

function readAnswers(value: Prisma.JsonValue): GuideAnswers {
  return (value ?? {}) as unknown as GuideAnswers;
}

function readConflicts(value: Prisma.JsonValue): GuideConflictRule[] {
  return (value ?? []) as unknown as GuideConflictRule[];
}

/** Zapisovatelný tvar odpovědi pro Prisma Json sloupec. */
function toJson(answers: GuideAnswers): Prisma.InputJsonValue {
  return answers as unknown as Prisma.InputJsonValue;
}

// --- Definice scénáře -------------------------------------------------------

type ScenarioWithSteps = Prisma.GuideScenarioGetPayload<{
  include: { steps: true };
}>;

/** Poskládá čistou definici scénáře z DB řádků (kroky seřazené dle `position`). */
function toDefinition(scenario: ScenarioWithSteps): GuideScenarioDefinition {
  const steps: GuideStepDefinition[] = [...scenario.steps]
    .sort((a, b) => a.position - b.position)
    .map((step) => ({
      key: step.key,
      type: step.type as GuideStepType,
      prompt: step.prompt,
      help: step.help ?? undefined,
      options:
        (step.options as unknown as GuideStepDefinition["options"]) ?? [],
      config: (step.config as unknown as GuideStepDefinition["config"]) ?? {},
      condition:
        (step.condition as unknown as GuideStepDefinition["condition"]) ??
        undefined,
      required: step.required,
    }));

  return {
    slug: scenario.slug,
    version: scenario.version,
    name: scenario.name,
    steps,
    conflicts: readConflicts(scenario.conflicts),
  };
}

/**
 * Založí/aktualizuje scénář z definice (idempotentně dle [slug, verze]). Kroky se
 * při reseedu přepíšou (delete + create). Volá seed; produkční editaci řeší T035.
 */
export async function syncScenario(
  def: GuideScenarioDefinition,
): Promise<{ id: string }> {
  return db.$transaction(async (tx) => {
    const scenario = await tx.guideScenario.upsert({
      where: { slug_version: { slug: def.slug, version: def.version } },
      update: {
        name: def.name,
        active: true,
        conflicts: (def.conflicts ?? []) as unknown as Prisma.InputJsonValue,
      },
      create: {
        slug: def.slug,
        version: def.version,
        name: def.name,
        conflicts: (def.conflicts ?? []) as unknown as Prisma.InputJsonValue,
      },
    });

    await tx.guideStep.deleteMany({ where: { scenarioId: scenario.id } });
    await tx.guideStep.createMany({
      data: def.steps.map((step, index) => ({
        scenarioId: scenario.id,
        key: step.key,
        type: step.type as GuideStepType,
        position: index,
        prompt: step.prompt,
        help: step.help ?? null,
        options: (step.options ?? []) as unknown as Prisma.InputJsonValue,
        config: (step.config ?? {}) as unknown as Prisma.InputJsonValue,
        condition:
          step.condition === undefined
            ? Prisma.JsonNull
            : (step.condition as unknown as Prisma.InputJsonValue),
        required: step.required ?? true,
      })),
    });

    return { id: scenario.id };
  });
}

/** Aktivní scénář pro slug = nejvyšší `active` verze (`null`, žádná neexistuje). */
async function pickActiveScenario(
  slug: string,
): Promise<ScenarioWithSteps | null> {
  return db.guideScenario.findFirst({
    where: { slug, active: true },
    orderBy: { version: "desc" },
    include: { steps: true },
  });
}

// --- Náhled session ---------------------------------------------------------

export interface GuideSessionView {
  id: string;
  token: string;
  userId: string | null;
  scenarioId: string;
  scenarioSlug: string;
  scenarioName: string;
  version: number;
  state: "active" | "completed" | "abandoned";
  nextStep: GuideStepDefinition | null;
  summary: GuideSummary;
}

function buildView(
  session: {
    id: string;
    token: string;
    userId: string | null;
    state: string;
    answers: Prisma.JsonValue;
  },
  scenario: ScenarioWithSteps,
): GuideSessionView {
  const def = toDefinition(scenario);
  const answers = readAnswers(session.answers);
  const { nextStep } = resolveGuide(def, answers);
  return {
    id: session.id,
    token: session.token,
    userId: session.userId,
    scenarioId: scenario.id,
    scenarioSlug: scenario.slug,
    scenarioName: scenario.name,
    version: scenario.version,
    state: session.state as GuideSessionView["state"],
    nextStep,
    summary: getSummary(def, answers),
  };
}

// --- Životní cyklus session -------------------------------------------------

export type StartSessionResult =
  | { ok: true; view: GuideSessionView }
  | { ok: false; reason: "no_active_scenario" };

/**
 * Založí session nad aktivním scénářem. Anonymnímu vygeneruje `token` (uloží se do
 * cookie ve volající vrstvě); přihlášenému rovnou naplní `userId`.
 */
export async function startSession(params: {
  slug: string;
  accessor: GuideSessionAccessor;
}): Promise<StartSessionResult> {
  const scenario = await pickActiveScenario(params.slug);
  if (!scenario) return { ok: false, reason: "no_active_scenario" };

  const token = params.accessor.token ?? generateToken();
  const session = await db.guideSession.create({
    data: {
      scenarioId: scenario.id,
      userId: params.accessor.userId ?? null,
      token,
      answers: {},
    },
  });

  trackEvent("guide.started", {
    sessionId: session.id,
    scenarioSlug: scenario.slug,
    version: scenario.version,
    anonymous: session.userId === null,
  });

  return { ok: true, view: buildView(session, scenario) };
}

/** Načte session i s jejím scénářem; `null`, pokud neexistuje. */
async function loadSession(sessionId: string) {
  const session = await db.guideSession.findUnique({
    where: { id: sessionId },
    include: { scenario: { include: { steps: true } } },
  });
  return session;
}

export type GetSessionResult =
  | { ok: true; view: GuideSessionView }
  | { ok: false; reason: "not_found" | "forbidden" };

/** Vrátí náhled session (pro vlastníka). */
export async function getSession(
  sessionId: string,
  accessor: GuideSessionAccessor,
): Promise<GetSessionResult> {
  const session = await loadSession(sessionId);
  if (!session) return { ok: false, reason: "not_found" };
  if (!canAccessSession(session, accessor))
    return { ok: false, reason: "forbidden" };
  return { ok: true, view: buildView(session, session.scenario) };
}

export type AnswerResult =
  | { ok: true; view: GuideSessionView }
  | {
      ok: false;
      reason:
        | "not_found"
        | "forbidden"
        | "not_active"
        | "unknown_step"
        | "not_visible"
        | "invalid_answer";
      error?: string;
    };

/**
 * Zapíše odpověď na krok a přepočítá stav. Ověří vlastnictví, aktivní stav,
 * viditelnost kroku i platnost hodnoty. Když se tím vyčerpají všechny viditelné
 * kroky, session přejde do `completed`.
 */
export async function answerStep(params: {
  sessionId: string;
  stepKey: string;
  answer: GuideAnswer;
  accessor: GuideSessionAccessor;
}): Promise<AnswerResult> {
  const session = await loadSession(params.sessionId);
  if (!session) return { ok: false, reason: "not_found" };
  if (!canAccessSession(session, params.accessor)) {
    return { ok: false, reason: "forbidden" };
  }
  if (session.state !== "active") return { ok: false, reason: "not_active" };

  const def = toDefinition(session.scenario);
  const step = def.steps.find((s) => s.key === params.stepKey);
  if (!step) return { ok: false, reason: "unknown_step" };

  const valueCheck = validateAnswer(step, params.answer);
  if (!valueCheck.ok) {
    return { ok: false, reason: "invalid_answer", error: valueCheck.error };
  }

  const answers = readAnswers(session.answers);
  const applied = applyAnswer(def, answers, params.stepKey, params.answer);
  if (!applied.ok) return { ok: false, reason: applied.reason };

  const resolved = resolveGuide(def, applied.answers);
  const nowComplete = resolved.progress.complete;

  const updated = await db.guideSession.update({
    where: { id: session.id },
    data: {
      answers: toJson(applied.answers),
      ...(nowComplete ? { state: "completed", completedAt: new Date() } : {}),
    },
  });

  trackEvent("guide.step_answered", {
    sessionId: session.id,
    stepKey: params.stepKey,
    status: params.answer.status,
    staleAnswerKeys: applied.staleAnswerKeys,
  });
  if (nowComplete) {
    trackEvent("guide.completed", {
      sessionId: session.id,
      scenarioSlug: def.slug,
      version: def.version,
    });
  }

  return { ok: true, view: buildView(updated, session.scenario) };
}

/** Opustí session (uživatelsky nebo časovým limitem). Idempotentní. */
export async function abandonSession(
  sessionId: string,
  accessor: GuideSessionAccessor,
): Promise<GetSessionResult> {
  const session = await loadSession(sessionId);
  if (!session) return { ok: false, reason: "not_found" };
  if (!canAccessSession(session, accessor))
    return { ok: false, reason: "forbidden" };
  if (session.state !== "active") {
    return { ok: true, view: buildView(session, session.scenario) };
  }

  const updated = await db.guideSession.update({
    where: { id: session.id },
    data: { state: "abandoned", completedAt: new Date() },
  });
  trackEvent("guide.abandoned", { sessionId: session.id });
  return { ok: true, view: buildView(updated, session.scenario) };
}

/**
 * Připojí anonymní session (dle tokenu z cookie) k účtu po registraci/loginu
 * (legacy-master-spec §54). Doplní `userId` jen tam, kde ještě chybí. Vrací počet
 * připojených session.
 */
export async function attachSessionsToUser(params: {
  token: string;
  userId: string;
}): Promise<number> {
  const { count } = await db.guideSession.updateMany({
    where: { token: params.token, userId: null },
    data: { userId: params.userId },
  });
  return count;
}

/** Neuhádnutelný token anonymní session (do cookie). */
export function generateToken(): string {
  return randomBytes(24).toString("base64url");
}
