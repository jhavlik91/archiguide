import bcrypt from "bcryptjs";

// Náklady bcryptu. 10–12 je rozumný kompromis mezi bezpečností a latencí.
const BCRYPT_ROUNDS = 12;

/** Zahashuje heslo pro uložení do `credentials.passwordHash`. */
export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/** Ověří heslo proti uloženému hashi. Nikdy nevyhazuje na neplatný hash. */
export function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
