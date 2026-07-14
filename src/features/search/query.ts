/**
 * Čistá logika sestavení a sanitizace vyhledávacího dotazu (T034). Bez DB a
 * `next/*` — snadno testovatelné a použitelné i na klientu. Fulltext běží nad
 * Postgres `to_tsquery`, proto musí být vstup uživatele bezpečně escapovaný:
 * z dotazu si bereme jen alfanumerické „tokeny" a skládáme z nich prefixový
 * `to_tsquery` (`slovo:*`), takže žádný operátor tsquery se z uživatelského
 * textu nikdy neprovede (§ Validation — tsquery escapování).
 */

/** Max. délka jednoho tokenu (delší se ořízne — obrana proti nesmyslům/DoS). */
const MAX_TERM_LENGTH = 40;
/** Max. počet tokenů z jednoho dotazu (zbytek se zahodí). */
const MAX_TERMS = 10;

/**
 * Rozloží surový dotaz na alfanumerické tokeny (unicode písmena/číslice; diakritiku
 * ponechává — sjednotí ji `unaccent` až v SQL). Vše ostatní (`&|!():*'` apod.) je
 * oddělovač a zároveň se tím z dotazu odstraní veškeré tsquery operátory.
 */
export function tokenize(raw: string): string[] {
  const tokens = raw
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 0)
    .map((t) => t.slice(0, MAX_TERM_LENGTH));
  return tokens.slice(0, MAX_TERMS);
}

/**
 * Sestaví prefixový `to_tsquery` řetězec z tokenů (`slovo:* & dalsi:*`), nebo
 * `null`, když dotaz nemá žádný použitelný token. Řetězec se v SQL ještě obalí
 * `unaccent()`, aby dotaz ignoroval diakritiku stejně jako index; `:*` a `&`
 * unaccent nechává být, takže prefixové/AND chování zůstává.
 */
export function buildTsQuery(raw: string): string | null {
  const tokens = tokenize(raw);
  if (tokens.length === 0) return null;
  return tokens.map((t) => `${t}:*`).join(" & ");
}
