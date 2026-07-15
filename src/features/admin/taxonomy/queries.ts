import "server-only";

import { db } from "@/lib/db";
import { matchProfessions } from "@/features/taxonomy";

/**
 * Čtecí vrstva admin správy taxonomie (T035 § Main flow 4). Na rozdíl od
 * veřejné `features/taxonomy/queries.ts` (jen `active`) vrací i archivované
 * položky, aby je admin mohl znovu aktivovat.
 */

/** Strom kategorií se VŠEMI profesemi (aktivní i archivované), pro admin. */
export function listCategoriesForAdmin() {
  return db.professionCategory.findMany({
    orderBy: { position: "asc" },
    include: {
      professions: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          slug: true,
          name: true,
          synonyms: true,
          regulated: true,
          verificationHints: true,
          status: true,
          position: true,
          _count: { select: { profileLinks: true } },
        },
      },
    },
  });
}

/** Počet profilů, které profesi aktivně používají — pro rozhodnutí smazat/deaktivovat. */
export async function countProfessionUsage(professionId: string): Promise<number> {
  return db.profileProfession.count({ where: { professionId } });
}

/**
 * Existuje profese s podobným názvem/synonymem (T035 § Edge cases: duplicitní
 * profese)? Použije stejnou shodovací logiku jako vyhledávání (`matchProfessions`),
 * jen zahrne i archivované — admin má vidět i skryté duplicity.
 */
export async function findSimilarProfessions(
  name: string,
  excludeId?: string,
) {
  const all = await db.profession.findMany({
    select: { id: true, name: true, synonyms: true, status: true },
  });
  const candidates = all.filter((p) => p.id !== excludeId);
  return matchProfessions(candidates, name, { includeArchived: true });
}
