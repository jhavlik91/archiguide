/**
 * Sanitizace `returnUrl` z query parametru. Hodnota je pod kontrolou útočníka
 * (odkaz `/login?returnUrl=…`), proto povolujeme jen interní absolutní cesty —
 * jinak by šlo po přihlášení přesměrovat na cizí web (open redirect).
 */
export function safeReturnUrl(
  value: string | null | undefined,
  fallback = "/dashboard",
): string {
  // Povolena jen cesta začínající jedním `/` — `//host` a `/\host` prohlížeč
  // interpretuje jako protokol-relativní URL na cizí doménu.
  if (!value || !/^\/(?![/\\])/.test(value)) return fallback;
  return value;
}
