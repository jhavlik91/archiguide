import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { PHONE_CODE_LENGTH } from "./constants";

/**
 * Tajemství verifikačních výzev (T011). Klientovi putuje plaintext (kód v SMS,
 * token v odkazu); v DB držíme jen SHA-256 hash, takže únik databáze neumožní
 * ověření cizího kontaktu.
 */

/** Deterministicky zahashuje tajemství (kód/token) pro uložení a porovnání. */
export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

/**
 * Náhodný číselný kód dané délky (výchozí `PHONE_CODE_LENGTH`). Používá
 * kryptograficky bezpečný `randomInt`, včetně vedoucích nul.
 */
export function generateNumericCode(length = PHONE_CODE_LENGTH): string {
  let code = "";
  for (let i = 0; i < length; i++) code += randomInt(0, 10).toString();
  return code;
}

/** Token pro e-mailový verifikační odkaz (plaintext do e-mailu, hash do DB). */
export function createEmailToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashSecret(token) };
}

/**
 * Porovná zadané tajemství s uloženým hashem v konstantním čase vůči délce
 * hashe. `null` uložený hash (žádná aktivní výzva) nikdy neprojde.
 */
export function secretMatches(secret: string, storedHash: string | null): boolean {
  if (!storedHash) return false;
  const candidate = Buffer.from(hashSecret(secret));
  const stored = Buffer.from(storedHash);
  if (candidate.length !== stored.length) return false;
  return timingSafeEqual(candidate, stored);
}
