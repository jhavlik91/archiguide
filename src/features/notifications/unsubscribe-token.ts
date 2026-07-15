import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { NOTIFICATION_GROUPS, type NotificationGroup } from "./types";

/**
 * Bezstavový token pro one-click unsubscribe z e-mailové patičky (T033 §
 * Alternative flows — "potvrzení + okamžitá platnost bez přihlášení"). Na
 * rozdíl od `PasswordResetToken` (T003) se nic neukládá do DB: podpis (HMAC
 * s `AUTH_SECRET`) token sám ověří a nikdy nevyprší ani se nespotřebuje —
 * odkaz v e-mailu musí fungovat i za měsíc, opakovaný klik je no-op (idempotentní
 * vypnutí kanálu). Kdo zná `AUTH_SECRET`, může token padělat, ale to platí i pro
 * session JWT (Auth.js) — stejná důvěryhodná hranice.
 *
 * `target` je buď skupina událostí (vypne e-mail jen pro tu skupinu), nebo
 * sentinel `"digest"` (odkaz z periodického digestu vrátí frekvenci na
 * `immediate`, protože digest sám žádnou skupinu nereprezentuje).
 */

export const DIGEST_UNSUBSCRIBE_TARGET = "digest" as const;

export type UnsubscribeTarget =
  | NotificationGroup
  | typeof DIGEST_UNSUBSCRIBE_TARGET;

export type UnsubscribePayload = {
  userId: string;
  target: UnsubscribeTarget;
};

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET není nastaven");
  return value;
}

function sign(payloadEncoded: string): string {
  return createHmac("sha256", secret()).update(payloadEncoded).digest("base64url");
}

function isValidTarget(value: string): value is UnsubscribeTarget {
  return (
    value === DIGEST_UNSUBSCRIBE_TARGET ||
    NOTIFICATION_GROUPS.includes(value as NotificationGroup)
  );
}

/** Vygeneruje token pro odkaz `/unsubscribe?token=...`. */
export function createUnsubscribeToken(
  userId: string,
  target: UnsubscribeTarget,
): string {
  const payloadEncoded = Buffer.from(`${userId}.${target}`, "utf8").toString(
    "base64url",
  );
  return `${payloadEncoded}.${sign(payloadEncoded)}`;
}

/** Ověří token a vrátí payload, nebo `null` při neplatném/podvrženém tokenu. */
export function verifyUnsubscribeToken(
  token: string,
): UnsubscribePayload | null {
  const [payloadEncoded, signature] = token.split(".");
  if (!payloadEncoded || !signature) return null;

  const expected = Buffer.from(sign(payloadEncoded));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  const [userId, target] = Buffer.from(payloadEncoded, "base64url")
    .toString("utf8")
    .split(".");
  if (!userId || !target || !isValidTarget(target)) return null;

  return { userId, target };
}
