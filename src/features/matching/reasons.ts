/**
 * Skládá strukturované důvody doporučení (T028 `MatchReason[]`) do jedné
 * lidsky čitelné věty (T029 § Main flow bod 2 — „Doporučeno, protože studio
 * realizovalo 8 rekonstrukcí bytů podobné velikosti a působí ve vašem
 * regionu."). Čistá funkce — nepřidává žádný fakt, který v `reasons` není, jen
 * spojuje existující, už ověřené `detail` texty (`scoring.ts`) do jedné klauze.
 */

import type { MatchReason } from "./types";

function decapitalizeFirst(text: string): string {
  if (text.length === 0) return text;
  return text[0]!.toLowerCase() + text.slice(1);
}

function stripTrailingPeriod(text: string): string {
  return text.endsWith(".") ? text.slice(0, -1) : text;
}

/** Sestaví jednu souvislou větu z `≥1` důvodů. Prázdný seznam vrátí "". */
export function formatReasons(reasons: readonly MatchReason[]): string {
  if (reasons.length === 0) return "";

  const clauses = reasons.map((r) =>
    stripTrailingPeriod(decapitalizeFirst(r.detail.trim())),
  );
  if (clauses.length === 1) {
    return `Doporučeno, protože ${clauses[0]}.`;
  }

  const last = clauses[clauses.length - 1];
  const rest = clauses.slice(0, -1);
  return `Doporučeno, protože ${rest.join(", ")} a ${last}.`;
}
