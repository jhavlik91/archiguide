import type { UserStatus } from "@prisma/client";

/**
 * Rozhodovací logika pro přihlášení přes Google (OAuth), oddělená od DB kvůli
 * testovatelnosti. Vrací, co má side-effect vrstva provést.
 *
 * - `block`     — účet je smazaný, přihlášení se odmítne (T003 edge case).
 * - `link`      — existující účet, jen doplnit vazbu na Google.
 * - `reactivate`— existující deaktivovaný účet; přihlášení přes Google jej
 *                 obnoví (vědomá akce vlastníka e-mailu u providera).
 * - `create`    — žádný účet s tímto e-mailem, založí se nový.
 */
export type GoogleLinkDecision = "block" | "link" | "reactivate" | "create";

export function decideGoogleLink(
  existing: { status: UserStatus } | null,
): GoogleLinkDecision {
  if (!existing) return "create";
  switch (existing.status) {
    case "deleted":
      return "block";
    case "deactivated":
      return "reactivate";
    default:
      return "link";
  }
}
