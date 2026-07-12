"use server";

import { redirect } from "next/navigation";
import { trackEvent } from "@/lib/analytics";
import { getGuideAccessor } from "./accessor";
import { writeSessionToken } from "./session-cookie";
import {
  answerStep,
  getSession,
  startSession,
  abandonSession,
  type AnswerResult,
  type GuideSessionView,
} from "./service";
import type { GuideAnswer } from "./types";

/**
 * Server akce guide runneru (T018). Tenká vrstva nad service (T017): sestaví
 * identitu žadatele (`getGuideAccessor`) a deleguje. Server zůstává autoritou —
 * viditelnost kroku i validace hodnoty řeší engine, klient jen vykresluje.
 */

// --- Výběr scénáře / start --------------------------------------------------

/**
 * Založí session nad zvoleným scénářem a přejde do runneru. Volá se jako `action`
 * formuláře z výběrové obrazovky (`startGuideScenario.bind(null, slug)`), takže
 * funguje i bez JS. Token session propíše do cookie (viz `startSession` — při
 * kolizi tokenu vrací nový).
 */
export async function startGuideScenario(slug: string): Promise<void> {
  const accessor = await getGuideAccessor();
  const result = await startSession({ slug, accessor });
  if (!result.ok) redirect("/guide?error=no_scenario");

  await writeSessionToken(result.view.token);
  trackEvent("guide.scenario_selected", {
    scenarioSlug: slug,
    sessionId: result.view.id,
    anonymous: result.view.userId === null,
  });
  redirect(`/guide/${result.view.id}`);
}

// --- Odpověď na krok --------------------------------------------------------

export type SubmitAnswerResult =
  { ok: true; view: GuideSessionView } | { ok: false; error: string };

const ANSWER_ERROR_MESSAGES: Record<
  Exclude<AnswerResult, { ok: true }>["reason"],
  string
> = {
  not_found: "Průvodce nebyl nalezen.",
  forbidden: "K tomuto průvodci nemáte přístup.",
  not_active: "Tento průvodce je již dokončený.",
  unknown_step: "Neznámý krok.",
  not_visible: "Tento krok teď není na řadě.",
  invalid_answer: "Zkontrolujte prosím zadanou odpověď.",
};

/**
 * Zapíše odpověď na krok a vrátí přepočítaný náhled session (další krok, shrnutí,
 * stav). Autosave je tím inherentní — odpověď se ukládá při každém volání. Chyby
 * se vrací jako výsledek (bez vyhození), aby je runner uměl zobrazit.
 */
export async function submitGuideAnswer(
  sessionId: string,
  stepKey: string,
  answer: GuideAnswer,
): Promise<SubmitAnswerResult> {
  const accessor = await getGuideAccessor();
  const result = await answerStep({ sessionId, stepKey, answer, accessor });
  if (result.ok) return { ok: true, view: result.view };
  return {
    ok: false,
    error: result.error ?? ANSWER_ERROR_MESSAGES[result.reason],
  };
}

// --- Resume / opuštění ------------------------------------------------------

/**
 * Pokračování v rozpracované session z banneru „Rozpracovaný záměr". Ověří
 * přístup, zaznamená event a přejde do runneru. `action` formuláře (funguje bez
 * JS); cizí/neexistující session pošle zpět na výběr.
 */
export async function resumeGuide(sessionId: string): Promise<void> {
  const accessor = await getGuideAccessor();
  const result = await getSession(sessionId, accessor);
  if (!result.ok) redirect("/guide");

  trackEvent("guide.resumed", { sessionId });
  redirect(`/guide/${sessionId}`);
}

/** Opustí rozpracovanou session (uživatelské „Skončit"). */
export async function abandonGuide(sessionId: string): Promise<void> {
  const accessor = await getGuideAccessor();
  await abandonSession(sessionId, accessor);
  redirect("/guide");
}

// --- Analytika souhrnu (T020) -----------------------------------------------

/**
 * Zaznamená zobrazení souhrnu (T020) a odvozené eventy: `guide.summary_viewed`
 * vždy, `guide.conflict_shown` při rozporech, `guide.safety_warning_shown` při
 * bezpečnostním upozornění. Volá se z klienta po zobrazení souhrnu (jednou za
 * mount). Ověří přístup přes `getSession`; cizí/nedokončenou session tiše ignoruje.
 */
export async function recordGuideSummaryView(sessionId: string): Promise<void> {
  const accessor = await getGuideAccessor();
  const result = await getSession(sessionId, accessor);
  if (!result.ok || result.view.state !== "completed") return;

  const { view } = result;
  trackEvent("guide.summary_viewed", {
    sessionId,
    scenarioSlug: view.scenarioSlug,
  });
  if (view.result && view.result.conflicts.length > 0) {
    trackEvent("guide.conflict_shown", {
      sessionId,
      count: view.result.conflicts.length,
    });
  }
  if (view.result && view.result.safetyOutcomes.length > 0) {
    trackEvent("guide.safety_warning_shown", { sessionId });
  }
}
