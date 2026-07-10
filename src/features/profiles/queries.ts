import "server-only";

import { cache } from "react";
import { getActor } from "@/lib/session";
import { isUser } from "@/lib/permissions";
import { getCategoryTree } from "@/features/taxonomy";
import { canViewProfile } from "./permissions";
import {
  getProfileByUserId,
  getPublicProfileBySlug,
  type ProfileWithProfessions,
  type PublicProfile,
} from "./service";
import { resolvePublicView, type PublicView } from "./public-view";

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

/** Veřejný profil + jak se má vykreslit pro aktuálního návštěvníka. */
export type PublicProfileResult = {
  profile: PublicProfile;
  view: Extract<PublicView, { visible: true }>;
  /** Je aktuální návštěvník vlastník? (pro vlastníkovské odkazy/lišty) */
  isOwner: boolean;
  /** Je návštěvník přihlášený? (CTA „Kontaktovat" vs. výzva k registraci) */
  isAuthenticated: boolean;
};

/**
 * Načte veřejný profil podle slugu a vyhodnotí viditelnost (T008 § Permissions).
 * `null` = profil neexistuje nebo na něj návštěvník nemá právo → route dá 404.
 * Náhled draftu (`preview`) je jen pro přihlášeného vlastníka.
 *
 * Memoizováno per-request (`cache`), aby `generateMetadata`, OG obrázek i vlastní
 * render sáhly na DB jen jednou. Proto je `preview` poziční primitivní argument.
 */
export const getPublicProfile = cache(
  async (
    slug: string,
    preview = false,
  ): Promise<PublicProfileResult | null> => {
    const profile = await getPublicProfileBySlug(slug);
    if (!profile) return null;

    const actor = await getActor();
    const isAuthenticated = isUser(actor);
    const isOwner = isUser(actor) && actor.userId === profile.userId;

    const view = resolvePublicView({
      status: profile.status,
      userStatus: profile.user.status,
      isOwner,
      preview,
    });
    if (!view.visible) return null;

    return { profile, view, isOwner, isAuthenticated };
  },
);
