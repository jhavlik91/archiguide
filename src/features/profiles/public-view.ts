/**
 * Rozhodovací logika pro veřejnou stránku profilu (T008). Čistá vrstva (bez DB
 * a `next/*`), aby šla pokrýt unit testy a sdílet mezi route a metadaty.
 *
 * Pravidla (viz T008 § Permissions/States/Edge cases):
 * - Renderuje se jen `published` profil aktivního uživatele.
 * - `draft` vidí pouze vlastník a jen v režimu náhledu (`?preview=1`).
 * - Deaktivovaný/smazaný uživatel → nedostupné (404) pro všechny.
 */

export type ProfileStatus = "draft" | "published";
export type UserStatus = "active" | "deactivated" | "deleted";

/** Jak (a zda) se má profil vykreslit. */
export type PublicView =
  | { visible: true; mode: "public" | "preview" }
  | { visible: false };

export function resolvePublicView(input: {
  status: ProfileStatus;
  userStatus: UserStatus;
  isOwner: boolean;
  preview: boolean;
}): PublicView {
  // Neaktivní účet skryje profil úplně, i vlastníkovi (edge case: deaktivace).
  if (input.userStatus !== "active") return { visible: false };

  if (input.status === "published") return { visible: true, mode: "public" };

  // Draft: jen vlastník a jen s explicitním náhledem.
  if (input.isOwner && input.preview) return { visible: true, mode: "preview" };
  return { visible: false };
}

/** Má se stránka indexovat vyhledávači? Jen veřejný (published) render. */
export function isIndexable(view: PublicView): boolean {
  return view.visible && view.mode === "public";
}
