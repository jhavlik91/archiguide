import { createHash, randomBytes } from "node:crypto";

/**
 * Token pro reset hesla. Klientovi (do e-mailu) putuje náhodný plaintext;
 * v DB držíme jen jeho SHA-256 hash, takže únik databáze neumožní reset.
 */

/** Vygeneruje nový reset token (plaintext + hash pro uložení). */
export function createResetToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashResetToken(token) };
}

/** Deterministicky zahashuje token pro vyhledání/uložení. */
export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Reset token je platný, pokud nebyl použit a nevypršel. */
export function isResetTokenValid(
  record: { usedAt: Date | null; expiresAt: Date },
  now: Date = new Date(),
): boolean {
  return record.usedAt === null && record.expiresAt.getTime() > now.getTime();
}
