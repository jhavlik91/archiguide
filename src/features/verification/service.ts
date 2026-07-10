import "server-only";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { normalizeEmail, emailsCollide } from "@/lib/email";
import { sendVerificationEmail } from "@/features/auth/email";
import { sendSms } from "@/lib/sms";
import {
  EMAIL_TOKEN_TTL_MS,
  PHONE_CODE_TTL_MS,
  PHONE_MAX_ATTEMPTS,
} from "./constants";
import {
  createEmailToken,
  generateNumericCode,
  hashSecret,
  secretMatches,
} from "./codes";
import {
  type ConfirmOutcome,
  type VerificationType,
  evaluateCodeAttempt,
  isChallengeExpired,
} from "./rules";
import type { VerificationView } from "./types";

/**
 * Datová vrstva verifikace (T011). Jediné místo sahající na `db.verification`.
 * Stavový automat (`unverified` → `pending` → `verified`; `expired`) i reset při
 * změně kontaktu se vynucují tady; oprávnění (jen vlastník) řeší `actions.ts`.
 * MVP implementuje typy `email` a `phone`.
 */

const MVP_TYPES: readonly VerificationType[] = ["email", "phone"] as const;

/** Náhled stavu verifikací pro vlastníka (settings). Absence řádku = unverified. */
export async function listVerifications(
  userId: string,
): Promise<VerificationView[]> {
  const [rows, user] = await Promise.all([
    db.verification.findMany({ where: { userId } }),
    db.user.findUnique({ where: { id: userId }, select: { email: true } }),
  ]);
  const byType = new Map(rows.map((r) => [r.type as VerificationType, r]));

  return MVP_TYPES.map((type) => {
    const row = byType.get(type);
    if (!row) {
      return { type, status: "unverified" as const, value: null, attemptsLeft: null };
    }

    // E-mail ověřený na jinou než aktuální adresu už neplatí (změna resetuje).
    if (
      type === "email" &&
      row.status === "verified" &&
      user &&
      !emailsCollide(row.value, user.email)
    ) {
      return { type, status: "unverified" as const, value: null, attemptsLeft: null };
    }

    // Rozpracovaná výzva s vypršelou platností se zobrazí jako `expired`.
    const status =
      row.status === "pending" && isChallengeExpired(row) ? "expired" : row.status;

    const attemptsLeft =
      type === "phone" && status === "pending" && row.secretHash
        ? Math.max(0, PHONE_MAX_ATTEMPTS - row.attempts)
        : null;

    return { type, status, value: row.value, attemptsLeft };
  });
}

/**
 * Veřejně čitelný seznam ověřených typů pro odznaky (T008/T010). E-mail se počítá
 * jen tehdy, sedí-li ověřená hodnota s aktuálním e-mailem uživatele.
 */
export async function getVerifiedTypes(
  userId: string,
): Promise<VerificationType[]> {
  const [rows, user] = await Promise.all([
    db.verification.findMany({
      where: { userId, status: "verified" },
      select: { type: true, value: true },
    }),
    db.user.findUnique({ where: { id: userId }, select: { email: true } }),
  ]);

  return rows
    .filter((r) => {
      if (r.type === "email") {
        return user ? emailsCollide(r.value, user.email) : false;
      }
      return true;
    })
    .map((r) => r.type as VerificationType);
}

// --- E-mail -----------------------------------------------------------------

/**
 * Založí/obnoví e-mailovou výzvu a odešle verifikační odkaz. Idempotentní vůči
 * opakovaným žádostem — přepíše dosavadní výzvu novým tokenem (`pending`).
 * Je-li tentýž e-mail už ověřený, nedělá nic (`already_verified`) — opakovaná
 * žádost (např. ze zastaralého tabu) nesmí shodit ověřený stav zpět na pending.
 * Volá se po registraci, při znovuodeslání i po změně e-mailu.
 */
export async function startEmailVerification(params: {
  userId: string;
  email: string;
  baseUrl: string;
}): Promise<"sent" | "already_verified"> {
  const email = normalizeEmail(params.email);

  const existing = await db.verification.findUnique({
    where: { userId_type: { userId: params.userId, type: "email" } },
    select: { status: true, value: true },
  });
  if (
    existing?.status === "verified" &&
    emailsCollide(existing.value, email)
  ) {
    return "already_verified";
  }

  const { token, tokenHash } = createEmailToken();
  const expiresAt = new Date(Date.now() + EMAIL_TOKEN_TTL_MS);

  await db.verification.upsert({
    where: { userId_type: { userId: params.userId, type: "email" } },
    create: {
      userId: params.userId,
      type: "email",
      status: "pending",
      value: email,
      secretHash: tokenHash,
      expiresAt,
    },
    update: {
      status: "pending",
      value: email,
      secretHash: tokenHash,
      expiresAt,
      issuedAt: new Date(),
      verifiedAt: null,
      attempts: 0,
    },
  });

  await sendVerificationEmail(
    email,
    `${params.baseUrl}/verify?token=${token}`,
  );
  return "sent";
}

/** Výsledek potvrzení e-mailového odkazu. */
export type EmailConfirmResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "invalid" | "expired" };

/**
 * Potvrdí e-mail z odkazu. Nevyžaduje přihlášení — token sám identifikuje výzvu.
 * Vypršelý odkaz označí za `expired`; neznámý/použitý token je `invalid`.
 */
export async function confirmEmailToken(
  token: string,
): Promise<EmailConfirmResult> {
  const row = await db.verification.findFirst({
    where: { type: "email", status: "pending", secretHash: hashSecret(token) },
  });
  if (!row) return { ok: false, reason: "invalid" };

  if (isChallengeExpired(row)) {
    await db.verification.update({
      where: { id: row.id },
      data: { status: "expired", secretHash: null },
    });
    return { ok: false, reason: "expired" };
  }

  await db.verification.update({
    where: { id: row.id },
    data: {
      status: "verified",
      verifiedAt: new Date(),
      secretHash: null,
      expiresAt: null,
    },
  });
  return { ok: true, userId: row.userId };
}

/** Výsledek změny e-mailu. */
export type ChangeEmailResult =
  | { ok: true }
  | { ok: false; reason: "unchanged" | "taken" };

/**
 * Změní přihlašovací e-mail a resetuje jeho verifikaci (T011 § Edge cases).
 * Kolizi s existujícím účtem odmítne; unikát na `users.email` (citext) je zdroj
 * pravdy. Po změně odešle nový verifikační odkaz.
 */
export async function changeEmail(params: {
  userId: string;
  newEmail: string;
  baseUrl: string;
}): Promise<ChangeEmailResult> {
  const newEmail = normalizeEmail(params.newEmail);
  const user = await db.user.findUnique({
    where: { id: params.userId },
    select: { email: true },
  });
  if (!user) return { ok: false, reason: "unchanged" };
  if (emailsCollide(user.email, newEmail)) return { ok: false, reason: "unchanged" };

  try {
    await db.user.update({
      where: { id: params.userId },
      data: { email: newEmail },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { ok: false, reason: "taken" };
    }
    throw error;
  }

  // Reset verifikace na nový e-mail (upsert přepíše řádek do `pending`).
  await startEmailVerification({
    userId: params.userId,
    email: newEmail,
    baseUrl: params.baseUrl,
  });
  return { ok: true };
}

// --- Telefon ----------------------------------------------------------------

/**
 * Založí/obnoví telefonní výzvu a odešle 6místný kód SMS. Změna čísla existující
 * výzvu přepíše (reset). Telefon smí být použit i na jiném účtu — jen informace,
 * bez unikátu (T011 § Edge cases).
 */
export async function requestPhoneCode(params: {
  userId: string;
  phone: string;
}): Promise<void> {
  const code = generateNumericCode();
  const expiresAt = new Date(Date.now() + PHONE_CODE_TTL_MS);

  await db.verification.upsert({
    where: { userId_type: { userId: params.userId, type: "phone" } },
    create: {
      userId: params.userId,
      type: "phone",
      status: "pending",
      value: params.phone,
      secretHash: hashSecret(code),
      expiresAt,
    },
    update: {
      status: "pending",
      value: params.phone,
      secretHash: hashSecret(code),
      expiresAt,
      issuedAt: new Date(),
      verifiedAt: null,
      attempts: 0,
    },
  });

  await sendSms({
    to: params.phone,
    body: `ArchiGuide ověřovací kód: ${code}. Platí 10 minut.`,
    code,
  });
}

/**
 * Potvrdí telefon zadaným kódem. Vede stavový automat: shoda → `verified`,
 * vypršení nebo vyčerpání pokusů → `expired`, jinak inkrement pokusů.
 */
export async function confirmPhoneCode(params: {
  userId: string;
  code: string;
}): Promise<ConfirmOutcome | { result: "no_challenge" }> {
  const row = await db.verification.findUnique({
    where: { userId_type: { userId: params.userId, type: "phone" } },
  });
  if (!row || row.status !== "pending" || !row.secretHash) {
    return { result: "no_challenge" };
  }

  const outcome = evaluateCodeAttempt(
    row,
    secretMatches(params.code, row.secretHash),
    PHONE_MAX_ATTEMPTS,
  );

  switch (outcome.result) {
    case "verified":
      await db.verification.update({
        where: { id: row.id },
        data: {
          status: "verified",
          verifiedAt: new Date(),
          secretHash: null,
          expiresAt: null,
        },
      });
      break;
    case "expired":
      await db.verification.update({
        where: { id: row.id },
        data: { status: "expired", secretHash: null },
      });
      break;
    case "wrong_code": {
      const attempts = row.attempts + 1;
      const exhausted = attempts >= PHONE_MAX_ATTEMPTS;
      await db.verification.update({
        where: { id: row.id },
        data: {
          attempts,
          // Vyčerpané pokusy uzavřou výzvu — nový kód je nutné vyžádat znovu.
          ...(exhausted ? { status: "expired", secretHash: null } : {}),
        },
      });
      break;
    }
    case "too_many_attempts":
      break;
  }

  return outcome;
}
