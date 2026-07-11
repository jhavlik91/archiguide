/**
 * Rozhodovací logika pro veřejnou stránku firmy (T010). Čistá vrstva (bez DB
 * a `next/*`), aby šla pokrýt unit testy a sdílet mezi route a metadaty.
 *
 * Pravidla (viz T010 § Permissions/States):
 * - Renderuje se jen `active` firma.
 * - `archived` firma → nedostupné (404) pro veřejnost.
 *
 * Firma nemá koncept draft/náhled jako profil (T008) — je buď aktivní a veřejná,
 * nebo archivovaná a skrytá. Proto je resolver jednodušší (jen podle stavu).
 */

export type OrgStatus = "active" | "archived";

/** Je firma s daným stavem veřejně přístupná? */
export function isOrgPubliclyVisible(status: OrgStatus): boolean {
  return status === "active";
}
