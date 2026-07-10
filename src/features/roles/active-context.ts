import "server-only";

import { cookies } from "next/headers";
import type { ActiveContext } from "@/lib/permissions";

/**
 * Aktivní kontext (klient↔profesionál) drží first-party httpOnly cookie (T004).
 * Cookie je vázaná na prohlížeč/„session" a čte se per-request v `getActor`;
 * autorizace stojí na rolích z DB, kontext jen přepíná chování a UI.
 */
const COOKIE_NAME = "ag_active_context";
const ONE_YEAR = 60 * 60 * 24 * 365;

function isContext(value: string | undefined): value is ActiveContext {
  return value === "client" || value === "professional";
}

/** Přečte kontext z cookie; `undefined`, pokud není nastaven nebo je neplatný. */
export async function readActiveContext(): Promise<ActiveContext | undefined> {
  const value = (await cookies()).get(COOKIE_NAME)?.value;
  return isContext(value) ? value : undefined;
}

/** Uloží zvolený kontext do cookie. */
export async function writeActiveContext(context: ActiveContext): Promise<void> {
  (await cookies()).set(COOKIE_NAME, context, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_YEAR,
  });
}
