"use server";

import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { normalizeEmail } from "@/lib/email";
import { trackEvent } from "@/lib/analytics";
import { rateLimit } from "@/lib/rate-limit";
import { signIn, signOut } from "@/auth";
import { hashPassword, verifyPassword } from "./password";
import { sendPasswordResetEmail, sendVerificationEmail } from "./email";
import { createResetToken, hashResetToken, isResetTokenValid } from "./tokens";
import {
  AUTH_RATE_LIMIT,
  RESET_TOKEN_TTL_MS,
  loginSchema,
  registerSchema,
  resetConfirmSchema,
  resetRequestSchema,
} from "./validation";
import type { AuthActionResult } from "./types";

// --- pomocné funkce (neexportované) ---------------------------------------

async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

async function getBaseUrl(): Promise<string> {
  if (process.env.AUTH_URL) return process.env.AUTH_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

/** Rate-limit pro citlivou akci; vrací chybový výsledek nebo null (OK). */
async function guardRateLimit(
  action: string,
): Promise<AuthActionResult | null> {
  const ip = await getClientIp();
  const { allowed, retryAfterMs } = rateLimit(
    `${action}:${ip}`,
    AUTH_RATE_LIMIT.limit,
    AUTH_RATE_LIMIT.windowMs,
  );
  if (allowed) return null;
  return {
    ok: false,
    error: "rate_limited",
    message: `Příliš mnoho pokusů. Zkuste to za ${Math.ceil(retryAfterMs / 1000)} s.`,
  };
}

function fieldError(message: string): AuthActionResult {
  return { ok: false, error: "validation", message };
}

// --- registrace -------------------------------------------------------------

export async function register(
  _prev: AuthActionResult | null,
  formData: FormData,
): Promise<AuthActionResult> {
  const parsed = registerSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    acceptTerms: formData.get("acceptTerms") === "on",
  });
  if (!parsed.success) {
    return fieldError(parsed.error.issues[0]?.message ?? "Neplatný vstup.");
  }

  const limited = await guardRateLimit("register");
  if (limited) return limited;

  const email = normalizeEmail(parsed.data.email);
  const emailTaken: AuthActionResult = {
    // Pokrývá i „registrace e-mailem existujícího Google účtu“ — nezakládáme
    // duplicitu ani nepřebíráme cizí účet nastavením hesla.
    ok: false,
    error: "email_taken",
    message: "Účet s tímto e-mailem už existuje. Zkuste se přihlásit.",
  };
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return emailTaken;

  const passwordHash = await hashPassword(parsed.data.password);
  let user;
  try {
    user = await db.user.create({
      data: { email, credential: { create: { passwordHash } } },
    });
  } catch (error) {
    // Souběžná registrace stejného e-mailu — unique index (P2002) je zdroj
    // pravdy, kontrola výše je jen rychlá cesta.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return emailTaken;
    }
    throw error;
  }

  // Verifikační e-mail je zatím stub (napojení v T011/T033).
  const baseUrl = await getBaseUrl();
  await sendVerificationEmail(email, `${baseUrl}/verify?stub=1`);
  trackEvent("auth.registered", { userId: user.id });

  await signIn("credentials", {
    email,
    password: parsed.data.password,
    redirect: false,
  });
  return { ok: true, redirectTo: "/dashboard" };
}

// --- přihlášení -------------------------------------------------------------

export async function login(
  _prev: AuthActionResult | null,
  formData: FormData,
): Promise<AuthActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return fieldError(parsed.error.issues[0]?.message ?? "Neplatný vstup.");
  }

  const limited = await guardRateLimit("login");
  if (limited) return limited;

  const email = normalizeEmail(parsed.data.email);
  const user = await db.user.findUnique({
    where: { email },
    include: { credential: true },
  });

  const invalid: AuthActionResult = {
    ok: false,
    error: "invalid",
    message: "Nesprávný e-mail nebo heslo.",
  };
  if (!user?.credential) return invalid;

  const passwordOk = await verifyPassword(
    parsed.data.password,
    user.credential.passwordHash,
  );
  if (!passwordOk) return invalid;

  // Heslo sedí — rozhodni podle stavu účtu.
  if (user.status === "deleted") return invalid;
  if (user.status === "deactivated") {
    return {
      ok: false,
      error: "deactivated",
      message: "Účet je deaktivovaný. Chcete jej reaktivovat a přihlásit se?",
    };
  }

  trackEvent("auth.login", { userId: user.id });
  await signIn("credentials", {
    email,
    password: parsed.data.password,
    redirect: false,
  });
  return { ok: true, redirectTo: "/dashboard" };
}

// --- reaktivace deaktivovaného účtu ----------------------------------------

export async function reactivateAndLogin(
  _prev: AuthActionResult | null,
  formData: FormData,
): Promise<AuthActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return fieldError(parsed.error.issues[0]?.message ?? "Neplatný vstup.");
  }

  const limited = await guardRateLimit("login");
  if (limited) return limited;

  const email = normalizeEmail(parsed.data.email);
  const user = await db.user.findUnique({
    where: { email },
    include: { credential: true },
  });
  const invalid: AuthActionResult = {
    ok: false,
    error: "invalid",
    message: "Nesprávný e-mail nebo heslo.",
  };
  if (!user?.credential || user.status === "deleted") return invalid;
  const passwordOk = await verifyPassword(
    parsed.data.password,
    user.credential.passwordHash,
  );
  if (!passwordOk) return invalid;

  if (user.status === "deactivated") {
    await db.user.update({
      where: { id: user.id },
      data: { status: "active" },
    });
  }
  trackEvent("auth.login", { userId: user.id, reactivated: true });
  await signIn("credentials", {
    email,
    password: parsed.data.password,
    redirect: false,
  });
  return { ok: true, redirectTo: "/dashboard" };
}

// --- reset hesla: žádost ----------------------------------------------------

export async function requestPasswordReset(
  _prev: AuthActionResult | null,
  formData: FormData,
): Promise<AuthActionResult> {
  const parsed = resetRequestSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return fieldError(parsed.error.issues[0]?.message ?? "Neplatný e-mail.");
  }

  const limited = await guardRateLimit("reset");
  if (limited) return limited;

  const email = normalizeEmail(parsed.data.email);
  const user = await db.user.findUnique({
    where: { email },
    include: { credential: true },
  });

  // Odesíláme jen pro existující účet s heslem a jiný než smazaný. Odpověď je
  // ale vždy stejná, aby nešlo zjišťovat existenci účtu (enumerace).
  if (user?.credential && user.status !== "deleted") {
    const { token, tokenHash } = createResetToken();
    await db.passwordResetToken.create({
      data: {
        tokenHash,
        userId: user.id,
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });
    const baseUrl = await getBaseUrl();
    await sendPasswordResetEmail(
      email,
      `${baseUrl}/reset-password/confirm?token=${token}`,
    );
  }

  return {
    ok: true,
    redirectTo: undefined,
  };
}

// --- reset hesla: potvrzení -------------------------------------------------

export async function resetPassword(
  _prev: AuthActionResult | null,
  formData: FormData,
): Promise<AuthActionResult> {
  const parsed = resetConfirmSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return fieldError(parsed.error.issues[0]?.message ?? "Neplatný vstup.");
  }

  const limited = await guardRateLimit("reset");
  if (limited) return limited;

  const tokenHash = hashResetToken(parsed.data.token);
  const record = await db.passwordResetToken.findUnique({
    where: { tokenHash },
  });

  const invalidToken: AuthActionResult = {
    ok: false,
    error: "invalid_token",
    message: "Odkaz je neplatný nebo vypršel. Vyžádejte si nový.",
  };
  if (!record || !isResetTokenValid(record)) return invalidToken;

  const passwordHash = await hashPassword(parsed.data.password);
  // Jednorázovost: nastavení hesla a označení tokenu za použitý atomicky.
  await db.$transaction([
    db.credential.upsert({
      where: { userId: record.userId },
      create: { userId: record.userId, passwordHash },
      update: { passwordHash },
    }),
    db.passwordResetToken.update({
      where: { tokenHash },
      data: { usedAt: new Date() },
    }),
  ]);
  trackEvent("auth.password_reset", { userId: record.userId });

  return { ok: true, redirectTo: "/login" };
}

// --- odhlášení --------------------------------------------------------------

export async function signOutAction(): Promise<void> {
  // signOut vyvolá interní Next redirect (přes výjimku) na `/login`.
  await signOut({ redirectTo: "/login" });
}

// --- přihlášení přes Google -------------------------------------------------

export async function googleSignIn(): Promise<void> {
  // Vyvolá OAuth redirect na Google (přes interní Next redirect).
  await signIn("google", { redirectTo: "/dashboard" });
}
