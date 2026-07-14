import "server-only";

import { db } from "@/lib/db";
import type { ReportReason, ReportTargetType } from "./types";

/**
 * Datová vrstva reportů (T031). Jediné místo, které sahá na `db.report`.
 * Oprávnění (kdo smí nahlásit) řeší volající doména přes permission vrstvu; tady
 * drží invariant „nezakládej duplicitní OPEN report téhož cíle týmž reporterem"
 * (T036 pak duplicitu agreguje plně — počítadlo/historie).
 */

export type CreateReportInput = {
  reporterUserId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  note?: string;
};

/** Existuje otevřený report daného cíle od tohoto reportera? (dedupe). */
export async function findOpenReport(params: {
  reporterUserId: string;
  targetType: ReportTargetType;
  targetId: string;
}): Promise<{ id: string } | null> {
  return db.report.findFirst({
    where: {
      reporterUserId: params.reporterUserId,
      targetType: params.targetType,
      targetId: params.targetId,
      state: "open",
    },
    select: { id: true },
  });
}

/**
 * Založí report ve stavu `open`. Idempotentní na úrovni „stejný reporter + cíl":
 * pokud už otevřený report existuje, vrátí ho místo duplikátu ({@link findOpenReport}).
 * Ostatní přechody stavů a moderační akce řeší T036.
 */
export async function createReport(
  input: CreateReportInput,
): Promise<{ id: string; created: boolean }> {
  const existing = await findOpenReport(input);
  if (existing) return { id: existing.id, created: false };

  const report = await db.report.create({
    data: {
      reporterUserId: input.reporterUserId,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
      note: input.note,
    },
    select: { id: true },
  });
  return { id: report.id, created: true };
}
