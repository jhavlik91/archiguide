// Čtecí vrstva taxonomie nad Prisma klientem. Čtení je veřejné (číselník),
// zápis/správu řeší admin (T035). Vyhledávání běží nad malým číselníkem, proto
// se profese načtou a shoda se počítá v paměti (diakritika/synonyma) přes
// `matchProfessions` — sdílená logika se seed i unit testy.

import { db } from "@/lib/db";
import { matchProfessions, type MatchOptions } from "./match";

/// Vrátí strom kategorií s jejich aktivními profesemi, v pořadí dle číselníku.
/// Archivované profese se nenabízejí.
export function getCategoryTree() {
  return db.professionCategory.findMany({
    orderBy: { position: "asc" },
    include: {
      professions: {
        where: { status: "active" },
        orderBy: { position: "asc" },
      },
    },
  });
}

/// Najde profese odpovídající dotazu (podle názvu i synonyma), seřazené od
/// nejrelevantnějších. Archivované jsou ve výchozím stavu vynechány.
export async function findProfessions(
  query: string,
  options: MatchOptions = {},
) {
  const professions = await db.profession.findMany({
    where: options.includeArchived ? undefined : { status: "active" },
    include: { category: true },
  });

  return matchProfessions(professions, query, options);
}

/// Nejrelevantnější profese pro dotaz, nebo `null`. Pohodlný obal nad
/// `findProfessions` pro místa, kde stačí jeden výsledek.
export async function findProfession(
  query: string,
  options: MatchOptions = {},
) {
  const [best] = await findProfessions(query, options);
  return best ?? null;
}

/// Přeloží slugy profesí na jejich názvy (+ kategorii) pro zobrazení doporučení
/// (guide T020). Vrací mapu slug → profese; neznámé slugy v mapě chybí (volající
/// si doplní fallback). Zahrnuje i archivované profese, aby už rozhodnuté
/// doporučení nezmizelo kvůli pozdější změně číselníku.
export async function getProfessionsBySlugs(
  slugs: string[],
): Promise<Map<string, { slug: string; name: string; categoryName: string }>> {
  const unique = [...new Set(slugs)];
  if (unique.length === 0) return new Map();
  const rows = await db.profession.findMany({
    where: { slug: { in: unique } },
    include: { category: true },
  });
  return new Map(
    rows.map((p) => [
      p.slug,
      { slug: p.slug, name: p.name, categoryName: p.category.name },
    ]),
  );
}
