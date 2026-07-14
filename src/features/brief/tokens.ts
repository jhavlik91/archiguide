import { randomBytes } from "node:crypto";

/**
 * Token sdíleného odkazu na brief (T022). Na rozdíl od reset/pozvánka tokenů
 * (T003/T009) se drží v plaintextu — jde o CAPABILITY URL, kterou vlastník musí
 * umět znovu zobrazit a zkopírovat, a dává jen READ-ONLY přístup ke snapshotu,
 * který vlastník vědomě sdílel. Entropie (32 B) brání uhodnutí; odvolání
 * (`shareToken = null`) přístup okamžitě ukončí.
 */

/** Vygeneruje nový náhodný token sdíleného odkazu (URL-safe). */
export function createShareToken(): string {
  return randomBytes(32).toString("base64url");
}
