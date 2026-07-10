import "server-only";

import { getActor } from "@/lib/session";
import { getCategoryTree } from "@/features/taxonomy";
import { canViewProfile } from "./permissions";
import { getProfileByUserId, type ProfileWithProfessions } from "./service";

/**
 * Čtecí vrstva profilů (T007) pro stránky. Vynucuje viditelnost: publikovaný
 * profil je veřejný, draft jen vlastník (veřejná route až T008).
 */

/** Profil vlastníka pro editaci (bez ohledu na stav). `null`, když ještě není. */
export async function getOwnProfile(
  userId: string,
): Promise<ProfileWithProfessions | null> {
  return getProfileByUserId(userId);
}

/**
 * Profil pro aktuálního návštěvníka. Vrátí `null`, pokud neexistuje nebo na něj
 * návštěvník nemá právo (draft cizího uživatele).
 */
export async function getViewableProfile(
  userId: string,
): Promise<ProfileWithProfessions | null> {
  const profile = await getProfileByUserId(userId);
  if (!profile) return null;
  const actor = await getActor();
  return canViewProfile(actor, { status: profile.status, ownerId: userId })
    ? profile
    : null;
}

/** Strom kategorií/profesí pro výběr odbornosti (z taxonomie T005). */
export function getProfessionOptions() {
  return getCategoryTree();
}
