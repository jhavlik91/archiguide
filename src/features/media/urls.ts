/**
 * Sestavování URL pro servírování médií (T014/T015). Čistý modul (bez DB), aby ho
 * šlo použít na serveru (stránky, akce) i v klientu (editor).
 *
 * Verze (`v`) je časové razítko poslední změny assetu. Úprava i „vrátit originál"
 * (T015) mění `updatedAt`, takže se URL změní a prohlížeč/CDN načte novou verzi —
 * upravený obrázek se v publikovaném obsahu projeví hned (T015 § Edge cases).
 */

import type { MediaVariant } from "./types";

/** Verzní značka assetu z `updatedAt` (cache-busting po úpravě/revertu). */
export function assetVersion(updatedAt: Date): string {
  return String(updatedAt.getTime());
}

/** URL pro servírování varianty assetu. `base` vynutí základní derivát z originálu. */
export function mediaVariantUrl(
  assetId: string,
  variant: MediaVariant,
  opts: { version?: string; base?: boolean } = {},
): string {
  const params = new URLSearchParams();
  if (opts.version) params.set("v", opts.version);
  if (opts.base) params.set("base", "1");
  const query = params.toString();
  return `/api/media/${assetId}/${variant}${query ? `?${query}` : ""}`;
}
