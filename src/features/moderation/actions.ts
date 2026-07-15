"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getActor } from "@/lib/session";
// Import zároveň registruje oprávnění moderace (moderation.*).
import {
  canActOnReport,
  canReportContent,
  canSuspendAccount,
} from "./permissions";
import {
  applyModerationAction,
  reportContent,
  restoreTargetVisibility,
} from "./service";
import {
  moderationActionSchema,
  reportContentSchema,
  type ModerationActionInput,
  type ReportContentInput,
} from "./validation";
import type { ReportTargetType } from "./types";

/**
 * Server akce moderace (T036). Tenká vrstva nad service: ověří oprávnění a
 * validaci, deleguje. Report nikdy nepřesměruje (sdílená komponenta je dialog
 * embedovaný v cizí stránce — zůstává na místě, jen ukáže výsledek).
 */

export type ReportActionResult =
  { ok: true; deduped: boolean } | { ok: false; error: string };

/**
 * Podá nahlášení obsahu (T036 § Main flow bod 2). Volají konzumující domény
 * přes sdílenou komponentu (`components/report-button.tsx`).
 */
export async function reportContentAction(
  input: ReportContentInput,
): Promise<ReportActionResult> {
  const actor = await getActor();
  if (actor.kind !== "user") redirect("/login");
  if (!canReportContent(actor)) {
    return { ok: false, error: "K nahlášení obsahu nemáte oprávnění." };
  }

  const parsed = reportContentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Neplatné údaje nahlášení.",
    };
  }

  const result = await reportContent({
    targetType: parsed.data.targetType,
    targetId: parsed.data.targetId,
    reporterUserId: actor.userId,
    reason: parsed.data.reason,
    note: parsed.data.note,
  });
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.reason === "own_content"
          ? "Vlastní obsah nahlásit nelze."
          : "Nahlašovaný obsah nebyl nalezen.",
    };
  }
  return { ok: true, deduped: result.deduped };
}

export type ModerationActionResult =
  { ok: true } | { ok: false; error: string };

/**
 * Provede moderační akci nad reportem (T036 § Main flow bod 5). Suspenzi
 * (dočasnou i trvalou) smí jen admin (dle T035); ostatní akce moderátor+admin.
 */
export async function moderateReportAction(
  reportId: string,
  input: ModerationActionInput,
): Promise<ModerationActionResult> {
  const actor = await getActor();
  if (actor.kind !== "user") redirect("/login");
  if (!canActOnReport(actor)) {
    return { ok: false, error: "K moderaci reportů nemáte oprávnění." };
  }

  const parsed = moderationActionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Neplatné údaje akce.",
    };
  }

  const isSuspend =
    parsed.data.actionType === "suspend_temporary" ||
    parsed.data.actionType === "suspend_permanent";
  if (isSuspend && !canSuspendAccount(actor)) {
    return { ok: false, error: "Suspenzi účtu smí provést jen admin." };
  }

  const result = await applyModerationAction({
    reportId,
    moderatorUserId: actor.userId,
    actionType: parsed.data.actionType,
    reason: parsed.data.reason,
  });
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.reason === "invalid_transition"
          ? "Tento report už je vyřešený — akci nelze zopakovat."
          : "Report nebyl nalezen.",
    };
  }
  revalidatePath(`/admin/reports/${reportId}`);
  revalidatePath("/admin/reports");
  return { ok: true };
}

/** Obnoví viditelnost dříve skrytého cíle (T036 § States — `hidden → visible`). */
export async function restoreTargetVisibilityAction(
  targetType: ReportTargetType,
  targetId: string,
): Promise<ModerationActionResult> {
  const actor = await getActor();
  if (actor.kind !== "user") redirect("/login");
  if (!canActOnReport(actor)) {
    return { ok: false, error: "K moderaci reportů nemáte oprávnění." };
  }

  await restoreTargetVisibility({
    targetType,
    targetId,
    moderatorUserId: actor.userId,
  });
  revalidatePath("/admin/reports");
  return { ok: true };
}
