/**
 * Konstanty verifikace (T011 § Validation). Sdílené serverem i klientem
 * (validace kódu), proto bez závislostí.
 */

/** Délka SMS kódu pro telefon: 6 číslic. */
export const PHONE_CODE_LENGTH = 6;

/** Platnost SMS kódu: 10 minut. */
export const PHONE_CODE_TTL_MS = 10 * 60 * 1000;

/** Max. počet neúspěšných pokusů o zadání kódu, než je nutné poslat nový. */
export const PHONE_MAX_ATTEMPTS = 5;

/** Platnost e-mailového verifikačního odkazu: 24 hodin. */
export const EMAIL_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Rate limit odeslání výzvy (e-mail odkaz i SMS kód): 5 / min / uživatel.
 * Chrání před spamem znovuodeslání (T011 § Validation).
 */
export const VERIFICATION_SEND_RATE_LIMIT = {
  limit: 5,
  windowMs: 60 * 1000,
} as const;
