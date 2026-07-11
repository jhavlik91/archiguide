import { createHash, randomBytes } from "node:crypto";

/**
 * Token pozvánky do firmy (T009). Do e-mailu putuje náhodný plaintext; v DB
 * držíme jen jeho SHA-256 hash (stejný princip jako reset hesla v T003), takže
 * únik databáze neumožní připojit se k firmě.
 */

/** Vygeneruje nový token pozvánky (plaintext + hash pro uložení). */
export function createInvitationToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashInvitationToken(token) };
}

/** Deterministicky zahashuje token pro vyhledání/uložení. */
export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
