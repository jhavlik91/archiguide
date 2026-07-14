/**
 * Cesty briefu (T022). Čistý modul (bez DB / `next/*`), aby ho šlo importovat
 * i v klientských komponentách i v server akcích — na rozdíl od `actions.ts`
 * (`"use server"`), který smí exportovat jen async akce.
 */

/** Relativní cesta veřejné sdílené stránky pro daný token. */
export function sharedBriefPath(token: string): string {
  return `/sdileny-brief/${token}`;
}
