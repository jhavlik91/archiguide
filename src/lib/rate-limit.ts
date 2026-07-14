/**
 * Jednoduchý in-memory rate limiter (sliding window) pro jeden proces. Slouží
 * k omezení citlivých akcí (login, reset hesla) na 5 pokusů / min / IP dle
 * T003. V produkci s více instancemi by se nahradil sdíleným úložištěm (Redis);
 * pro MVP a dev je in-memory dostačující.
 */

export type RateLimitResult = {
  /** Zda je aktuální pokus povolen. */
  allowed: boolean;
  /** Kolik pokusů ještě zbývá v okně (0 při zablokování). */
  remaining: number;
  /** Za kolik ms se okno uvolní (0 pokud je pokus povolen). */
  retryAfterMs: number;
};

type Bucket = number[]; // časová razítka pokusů v aktuálním okně

const store = new Map<string, Bucket>();

/**
 * Vypnutí limiteru pro automatizované testy: e2e sada spouští desítky citlivých
 * akcí (registrace, login) z jedné IP a limit 5/min by ji nedeterministicky
 * shazoval. Nastavuje pouze e2e web server (playwright.config.ts). V produkci
 * se přepínač ignoruje — limiter je brute-force obrana (T003) a nesmí jít
 * vypnout omylem protečenou proměnnou prostředí.
 */
function isDisabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.RATE_LIMIT_DISABLED === "1"
  );
}

/**
 * Zaznamená pokus pod daným klíčem a vrátí, zda je povolen. Volání s efektem —
 * povolený pokus se do okna započítá; zablokovaný pokus okno neprodlužuje.
 *
 * @param key       Identifikátor (typicky `"<akce>:<ip>"`).
 * @param limit     Max. počet pokusů v okně.
 * @param windowMs  Délka okna v ms.
 * @param now       Injektovatelný čas (pro testy).
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  if (isDisabled()) {
    return { allowed: true, remaining: limit, retryAfterMs: 0 };
  }

  const windowStart = now - windowMs;
  const recent = (store.get(key) ?? []).filter((ts) => ts > windowStart);

  if (recent.length >= limit) {
    const oldest = recent[0];
    store.set(key, recent);
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(0, oldest + windowMs - now),
    };
  }

  recent.push(now);
  store.set(key, recent);
  return { allowed: true, remaining: limit - recent.length, retryAfterMs: 0 };
}

/** Vynuluje limity pro daný klíč (např. po úspěšném přihlášení). */
export function resetRateLimit(key: string): void {
  store.delete(key);
}

/** Pouze pro testy — vyprázdní celé úložiště. */
export function __clearRateLimitStore(): void {
  store.clear();
}
