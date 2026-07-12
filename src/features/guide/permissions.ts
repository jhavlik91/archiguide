/**
 * Oprávnění ke guide session (T017). Čisté pravidlo (bez DB / `next/*`).
 *
 * Session čte a píše jen její vlastník: přihlášený uživatel (shoda `userId`),
 * nebo anonym, který drží její `token` (z cookie). Připojením k účtu se z anonymní
 * stává uživatelská; token dál platí jako přístup (doběh z původního prohlížeče).
 */

/** Identita žadatele o přístup k session. */
export interface GuideSessionAccessor {
  userId?: string | null;
  token?: string | null;
}

/** Minimum vlastnických polí session pro rozhodnutí o přístupu. */
export interface GuideSessionOwner {
  userId: string | null;
  token: string;
}

/** Smí daný žadatel k session? Vlastnictví = shoda userId NEBO držení tokenu. */
export function canAccessSession(
  session: GuideSessionOwner,
  accessor: GuideSessionAccessor,
): boolean {
  if (session.userId && accessor.userId && session.userId === accessor.userId) {
    return true;
  }
  if (accessor.token && accessor.token === session.token) {
    return true;
  }
  return false;
}
