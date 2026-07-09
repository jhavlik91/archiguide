// Čisté (bez DB) pomocné funkce pro práci s taxonomií: normalizace textu,
// generování slugů a vyhledávání profese podle názvu/synonyma. Sdílí je jak
// seed a query vrstva, tak unit testy — proto nesmí záviset na Prisma klientu.

export type TaxonomyStatus = "active" | "archived";

/// Sjednotí text pro porovnávání: odstraní diakritiku, sníží na malá písmena
/// a ořízne okraje. „Topenář" i „topenar" tak dají stejný klíč.
export function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/// Vyrobí URL-friendly slug (bez diakritiky, oddělovač `-`).
export function slugify(value: string): string {
  return normalize(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/// Minimum, které vyhledávání potřebuje z profese — DB řádek i seed data ho
/// splňují, funkce proto zůstává generická přes konkrétní tvar.
export interface MatchableProfession {
  name: string;
  synonyms: string[];
  status: TaxonomyStatus;
}

/// Skóre shody profese s dotazem (vyšší = lepší); `null` = žádná shoda.
/// 3 = přesná shoda názvu, 2 = přesná shoda synonyma, 1 = částečná shoda.
function matchScore(
  profession: MatchableProfession,
  query: string,
): number | null {
  const q = normalize(query);
  if (!q) return null;

  const name = normalize(profession.name);
  if (name === q) return 3;

  const synonyms = profession.synonyms.map(normalize);
  if (synonyms.includes(q)) return 2;

  if (name.includes(q) || synonyms.some((s) => s.includes(q))) return 1;

  return null;
}

export interface MatchOptions {
  /// Zahrnout i archivované profese (výchozí false — nenabízí se v číselnících).
  includeArchived?: boolean;
}

/// Vrátí profese odpovídající dotazu, seřazené od nejrelevantnějších.
/// Archivované jsou ve výchozím stavu vynechány.
export function matchProfessions<T extends MatchableProfession>(
  professions: readonly T[],
  query: string,
  options: MatchOptions = {},
): T[] {
  const { includeArchived = false } = options;

  return professions
    .filter((p) => includeArchived || p.status === "active")
    .map((profession) => ({ profession, score: matchScore(profession, query) }))
    .filter(
      (entry): entry is { profession: T; score: number } =>
        entry.score !== null,
    )
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.profession);
}
