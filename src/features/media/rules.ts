/**
 * Čistá doménová pravidla médií (T014). Bez DB / `next/*` / `sharp`, aby šla
 * pokrýt unit testy a sdílet mezi service, akcemi i UI.
 *
 * Těžiště: rozhodnutí o mazání podle míst použití (usage) — originál musí zůstat
 * obnovitelný, publikované použití mazání blokuje.
 */

import type { MediaUsage } from "./usage";

export type DeleteDecision =
  | { kind: "blocked"; usages: MediaUsage[] } // použito v publikovaném → nemazat
  | { kind: "soft_delete_warn"; usages: MediaUsage[] } // použito v draftu → smazat s varováním
  | { kind: "soft_delete" }; // nikde nepoužito → smazat

/**
 * Rozhodne, co s žádostí o smazání assetu podle jeho použití:
 *  - jakékoli PUBLIKOVANÉ použití → `blocked` (blok s odkazy, T014 § Edge cases),
 *  - jen draftové použití → `soft_delete_warn` (měkké smazání, ale varuj),
 *  - žádné použití → `soft_delete`.
 *
 * Mazání je vždy MĚKKÉ (originál zůstává obnovitelný, zadani/16 §7) — proto ani
 * „blocked" nikdy nepřepisuje originál; jen zabrání změně stavu na `deleted`.
 */
export function decideDelete(usages: MediaUsage[]): DeleteDecision {
  const published = usages.filter((u) => u.published);
  if (published.length > 0) return { kind: "blocked", usages: published };
  if (usages.length > 0) return { kind: "soft_delete_warn", usages };
  return { kind: "soft_delete" };
}

/** Odkaz na vlastníka média (polymorfní — uživatel NEBO organizace). */
export type MediaOwnerRef =
  | { type: "user"; userId: string }
  | { type: "organization"; orgId: string };

/** Odvodí vlastníka z uložených sloupců (CHECK garantuje právě jeden). */
export function ownerRefOf(asset: {
  ownerUserId: string | null;
  ownerOrgId: string | null;
}): MediaOwnerRef {
  if (asset.ownerUserId) return { type: "user", userId: asset.ownerUserId };
  return { type: "organization", orgId: asset.ownerOrgId! };
}
