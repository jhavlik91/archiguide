/**
 * Cesty poptávky (T025). Čistý modul (bez DB / `next/*`), aby ho šlo importovat
 * i v klientských komponentách i v server akcích (`actions.ts` smí exportovat
 * jen async akce).
 */

/**
 * Veřejná anonymizovaná projekce poptávky (§20.2–20.3). Vlastník/admin vidí
 * náhled i v draftu; ostatní jen podle viditelnosti/pozvánky
 * (`canReadRequestPublicView`).
 */
export function publicRequestPath(requestId: string): string {
  return `/poptavka/${requestId}`;
}

/** Veřejný výpis aktivních poptávek s filtry (T026 § Main flow). */
export function publicRequestListPath(): string {
  return "/poptavky";
}
