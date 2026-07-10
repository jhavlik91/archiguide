/**
 * Čistá doménová logika verifikace (T011): stavový automat, predikáty výzvy a
 * popisky odznaků. Bez DB a bez `next/*` importů — použitelné i v klientských
 * komponentách (badge) a snadno testovatelné.
 *
 * `VerificationType` je zde zrcadlem enumu z prisma/schema.prisma (stejně jako
 * `Role` v lib/permissions.ts), aby tento modul nezávisel na Prisma klientu.
 */

/** Co se ověřuje. Musí odpovídat enum `VerificationType` v prisma/schema.prisma. */
export type VerificationType =
  | "email"
  | "phone"
  | "identity"
  | "business"
  | "qualification"
  | "authorization"
  | "insurance";

/** Stav ověření. Musí odpovídat enum `VerificationStatus`. */
export type VerificationStatus = "pending" | "verified" | "expired";

/** Typy, které MVP reálně ověřuje (ostatní jsou vyhrazené pro finální produkt). */
export const MVP_VERIFICATION_TYPES: readonly VerificationType[] = [
  "email",
  "phone",
] as const;

/**
 * Popisek odznaku — přesně uvádí, **co** bylo ověřeno (legacy-master-spec §37).
 * Odznak nikdy nezobrazuje samotný kontakt, jen ověřený fakt.
 */
export const VERIFICATION_LABELS: Record<VerificationType, string> = {
  email: "Ověřený e-mail",
  phone: "Ověřený telefon",
  identity: "Ověřená identita",
  business: "Ověřená firma",
  qualification: "Ověřená kvalifikace",
  authorization: "Ověřená autorizace",
  insurance: "Ověřené pojištění",
};

/** Minimální tvar výzvy pro predikáty (podmnožina modelu Verification). */
export type ChallengeState = {
  status: VerificationStatus;
  secretHash: string | null;
  expiresAt: Date | null;
  attempts: number;
};

/** Vypršela časově omezená výzva? (Bez `expiresAt` nikdy.) */
export function isChallengeExpired(
  challenge: Pick<ChallengeState, "expiresAt">,
  now: Date = new Date(),
): boolean {
  return challenge.expiresAt !== null && challenge.expiresAt.getTime() <= now.getTime();
}

/**
 * Lze na výzvu ještě odpovědět kódem? Musí být `pending`, mít tajemství, nebýt
 * vypršelá a nepřekročit limit pokusů (T011 § Validation).
 */
export function canConfirmChallenge(
  challenge: ChallengeState,
  maxAttempts: number,
  now: Date = new Date(),
): boolean {
  return (
    challenge.status === "pending" &&
    challenge.secretHash !== null &&
    challenge.attempts < maxAttempts &&
    !isChallengeExpired(challenge, now)
  );
}

/** Výsledek pokusu o potvrzení kódu — řídí zápis stavu ve service vrstvě. */
export type ConfirmOutcome =
  | { result: "verified" }
  | { result: "expired" }
  | { result: "too_many_attempts" }
  | { result: "wrong_code"; attemptsLeft: number };

/**
 * Vyhodnotí pokus o potvrzení kódu proti uloženému stavu. Čistá funkce —
 * neprovádí zápis, jen říká, co se má stát. `codeMatches` počítá volající
 * (porovnání hashů), aby sem netekla kryptografie.
 */
export function evaluateCodeAttempt(
  challenge: ChallengeState,
  codeMatches: boolean,
  maxAttempts: number,
  now: Date = new Date(),
): ConfirmOutcome {
  if (isChallengeExpired(challenge, now)) return { result: "expired" };
  if (challenge.attempts >= maxAttempts) return { result: "too_many_attempts" };
  if (codeMatches) return { result: "verified" };
  const attemptsLeft = Math.max(0, maxAttempts - (challenge.attempts + 1));
  return { result: "wrong_code", attemptsLeft };
}
