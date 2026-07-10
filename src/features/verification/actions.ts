"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getActor } from "@/lib/session";
import { can } from "@/lib/permissions";
import { trackEvent } from "@/lib/analytics";
import { rateLimit } from "@/lib/rate-limit";
import { db } from "@/lib/db";
// Import registruje oprávnění verifikace (verification.manage_own).
import { P_VERIFY_OWN } from "./permissions";
import { VERIFICATION_SEND_RATE_LIMIT } from "./constants";
import {
  changeEmail,
  confirmPhoneCode,
  requestPhoneCode,
  startEmailVerification,
} from "./service";
import { changeEmailSchema, confirmPhoneSchema, requestPhoneSchema } from "./validation";
import type { VerificationActionResult } from "./types";

const UNAUTHENTICATED: VerificationActionResult = {
  ok: false,
  error: "unauthenticated",
  message: "Přihlaste se prosím.",
};

function invalid(message = "Zkontrolujte zadané údaje."): VerificationActionResult {
  return { ok: false, error: "validation", message };
}

/** Ověří přihlášeného uživatele (verifikuje jen sám sebe). */
async function requireSelf(): Promise<
  { userId: string } | { result: VerificationActionResult }
> {
  const actor = await getActor();
  if (actor.kind !== "user" || !can(actor, P_VERIFY_OWN)) {
    return { result: UNAUTHENTICATED };
  }
  return { userId: actor.userId };
}

/** Rate-limit odeslání výzvy per uživatel (T011 § Validation). */
function guardSend(userId: string): VerificationActionResult | null {
  const { allowed, retryAfterMs } = rateLimit(
    `verify-send:${userId}`,
    VERIFICATION_SEND_RATE_LIMIT.limit,
    VERIFICATION_SEND_RATE_LIMIT.windowMs,
  );
  if (allowed) return null;
  return {
    ok: false,
    error: "rate_limited",
    message: `Příliš mnoho pokusů. Zkuste to za ${Math.ceil(retryAfterMs / 1000)} s.`,
  };
}

async function getBaseUrl(): Promise<string> {
  if (process.env.AUTH_URL) return process.env.AUTH_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

// --- E-mail -----------------------------------------------------------------

/** Znovu odešle verifikační odkaz na aktuální e-mail uživatele. */
export async function resendEmailVerification(): Promise<VerificationActionResult> {
  const guard = await requireSelf();
  if ("result" in guard) return guard.result;

  const limited = guardSend(guard.userId);
  if (limited) return limited;

  const user = await db.user.findUnique({
    where: { id: guard.userId },
    select: { email: true },
  });
  if (!user) return UNAUTHENTICATED;

  const outcome = await startEmailVerification({
    userId: guard.userId,
    email: user.email,
    baseUrl: await getBaseUrl(),
  });
  revalidatePath("/settings");
  if (outcome === "already_verified") {
    return { ok: true, message: "E-mail už je ověřený." };
  }
  return { ok: true, message: "Poslali jsme vám nový ověřovací odkaz." };
}

/** Změní e-mail a resetuje jeho verifikaci (pošle nový odkaz). */
export async function changeEmailAction(
  input: unknown,
): Promise<VerificationActionResult> {
  const guard = await requireSelf();
  if ("result" in guard) return guard.result;

  const parsed = changeEmailSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message);

  const limited = guardSend(guard.userId);
  if (limited) return limited;

  const result = await changeEmail({
    userId: guard.userId,
    newEmail: parsed.data.email,
    baseUrl: await getBaseUrl(),
  });
  if (!result.ok) {
    if (result.reason === "taken") {
      return {
        ok: false,
        error: "email_taken",
        message: "Tento e-mail už používá jiný účet.",
      };
    }
    return {
      ok: false,
      error: "email_unchanged",
      message: "Zadejte jiný e-mail, než máte nastavený.",
    };
  }
  revalidatePath("/settings");
  return {
    ok: true,
    message: "E-mail změněn. Ověřte ho odkazem, který jsme právě poslali.",
  };
}

// --- Telefon ----------------------------------------------------------------

/** Odešle 6místný ověřovací kód SMS na zadané číslo. */
export async function requestPhoneVerification(
  input: unknown,
): Promise<VerificationActionResult> {
  const guard = await requireSelf();
  if ("result" in guard) return guard.result;

  const parsed = requestPhoneSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message);

  const limited = guardSend(guard.userId);
  if (limited) return limited;

  await requestPhoneCode({ userId: guard.userId, phone: parsed.data.phone });
  revalidatePath("/settings");
  return { ok: true, message: "Poslali jsme vám ověřovací kód." };
}

/** Potvrdí telefon zadaným kódem. */
export async function confirmPhoneVerification(
  input: unknown,
): Promise<VerificationActionResult> {
  const guard = await requireSelf();
  if ("result" in guard) return guard.result;

  const parsed = confirmPhoneSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message);

  const outcome = await confirmPhoneCode({
    userId: guard.userId,
    code: parsed.data.code,
  });

  switch (outcome.result) {
    case "verified":
      trackEvent("verification.phone_completed", { userId: guard.userId });
      revalidatePath("/settings");
      return { ok: true, message: "Telefon je ověřený." };
    case "wrong_code":
      return {
        ok: false,
        error: "wrong_code",
        message: `Nesprávný kód. Zbývá pokusů: ${outcome.attemptsLeft}.`,
      };
    case "expired":
      return {
        ok: false,
        error: "expired",
        message: "Kód vypršel. Nechte si poslat nový.",
      };
    case "too_many_attempts":
      return {
        ok: false,
        error: "too_many_attempts",
        message: "Vyčerpali jste pokusy. Nechte si poslat nový kód.",
      };
    case "no_challenge":
      return {
        ok: false,
        error: "no_challenge",
        message: "Nejdřív si nechte poslat kód.",
      };
  }
}
