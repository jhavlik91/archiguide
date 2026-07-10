import type { VerificationType, VerificationStatus } from "./rules";

/**
 * Sdílené typy verifikace pro čtecí i akční vrstvu. Doménová logika a popisky
 * jsou v `rules.ts`; tvar `VerificationType`/`VerificationStatus` odtud zrcadlí
 * enum z prisma/schema.prisma.
 */

/** Náhled stavu jednoho typu verifikace pro UI vlastníka (settings). */
export type VerificationView = {
  type: VerificationType;
  status: VerificationStatus | "unverified";
  /** Ověřovaný/rozpracovaný kontakt — jen pro vlastníka (badge ho neukazuje). */
  value: string | null;
  /** Zbývající pokusy o zadání kódu (jen u pending telefonu). */
  attemptsLeft: number | null;
};

/** Výsledek verifikační akce (server action) pro UX ve formulářích. */
export type VerificationActionResult =
  | { ok: true; message?: string }
  | {
      ok: false;
      error:
        | "unauthenticated"
        | "validation"
        | "rate_limited"
        | "expired"
        | "too_many_attempts"
        | "wrong_code"
        | "no_challenge"
        | "email_taken"
        | "email_unchanged";
      message: string;
    };
