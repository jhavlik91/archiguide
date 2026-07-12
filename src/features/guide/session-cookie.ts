import "server-only";

import { cookies } from "next/headers";
import { generateToken } from "./service";

/**
 * Cookie s tokenem anonymní guide session (T017). Umožňuje nepřihlášenému
 * pokračovat v rozběhnutém guide napříč requesty a po registraci session připojit
 * k účtu (legacy-master-spec §54). First-party httpOnly cookie; autorizaci session
 * řeší `canAccessSession` (shoda tokenu nebo userId).
 *
 * UI vrstva (T018) čte token přes `readSessionToken`, zakládá session a token
 * ukládá `writeSessionToken`; po přihlášení pak `attachSessionsToUser`.
 */
const COOKIE_NAME = "ag_guide_session";
const ONE_YEAR = 60 * 60 * 24 * 365;

/** Přečte token guide session z cookie (`undefined`, pokud není). */
export async function readSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(COOKIE_NAME)?.value || undefined;
}

/** Uloží token guide session do cookie. */
export async function writeSessionToken(token: string): Promise<void> {
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_YEAR,
  });
}

/** Vrátí existující token z cookie, nebo vytvoří a uloží nový. */
export async function ensureSessionToken(): Promise<string> {
  const existing = await readSessionToken();
  if (existing) return existing;
  const token = generateToken();
  await writeSessionToken(token);
  return token;
}
