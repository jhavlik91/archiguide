import "server-only";

/**
 * Seam „kde je médium použité" (T014). Média jsou sdílená služba; konzumenti
 * (portfolio bloky T013/T016, fotka profilu T007, logo firmy, přílohy T023) se
 * na asset odkazují. Aby se média nemusela vázat na (zatím nezmergeované) domény,
 * konzumenti registrují resolver, který pro daný asset vrátí seznam použití.
 *
 * Slouží dvěma rozhodnutím:
 *  - MAZÁNÍ: asset použitý v PUBLIKOVANÉM obsahu smazat nelze (blok s odkazy);
 *    použití jen v draftu → měkké smazání s varováním (T014 § Main flow bod 4).
 *  - VEŘEJNÉ SERVÍROVÁNÍ: derivát se veřejně vydá jen u assetu s ≥1 publikovaným
 *    použitím (T014 § Permissions).
 *
 * Výchozí resolver hlásí „nikde použito" — dokud konzument nezaregistruje svůj,
 * je asset jen soukromý (vlastníkův) a volně smazatelný. Stejný vzor jako seam
 * na obsahové bloky v portfolio/service.ts.
 */

/** Jedno místo, kde je asset použitý — pro srozumitelný blok mazání i UI. */
export type MediaUsage = {
  /** Popisek místa použití (např. „Portfolio: Vila u lesa"). */
  label: string;
  /** Odkaz na místo použití (volitelný). */
  href?: string;
  /** Je to použití v PUBLIKOVANÉM (veřejném) obsahu? */
  published: boolean;
};

export type MediaUsageResolver = (assetId: string) => Promise<MediaUsage[]>;

const resolvers = new Set<MediaUsageResolver>();

/**
 * Zaregistruje zdroj použití assetu (konzument médií). Vrací funkci pro odhlášení
 * (užitečné v testech). Víc konzumentů se sčítá.
 */
export function registerMediaUsageResolver(
  resolver: MediaUsageResolver,
): () => void {
  resolvers.add(resolver);
  return () => resolvers.delete(resolver);
}

/** Jen pro testy: odregistruje všechny resolvery. */
export function __clearUsageResolvers(): void {
  resolvers.clear();
}

/** Sesbírá všechna použití assetu napříč registrovanými konzumenty. */
export async function collectUsages(assetId: string): Promise<MediaUsage[]> {
  const lists = await Promise.all(
    [...resolvers].map((resolve) => resolve(assetId)),
  );
  return lists.flat();
}

/** Je asset použitý v publikovaném obsahu? (rozhoduje veřejné servírování i blok mazání). */
export async function isUsedInPublished(assetId: string): Promise<boolean> {
  const usages = await collectUsages(assetId);
  return usages.some((u) => u.published);
}
