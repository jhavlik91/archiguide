import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Edge-safe základ konfigurace Auth.js. Neobsahuje Credentials provider ani
 * DB/bcrypt callbacky (běží jen v Node), takže jej lze bezpečně importovat do
 * middleware. Plnou konfiguraci skládá `src/auth.ts`.
 */

/** Google provider zapneme jen když jsou k dispozici OAuth klíče. */
export const googleEnabled = Boolean(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
);

export const authConfig = {
  // Za reverzní proxy / v CI důvěřujeme host hlavičce (AUTH_URL).
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: googleEnabled
    ? [Google({ allowDangerousEmailAccountLinking: false })]
    : [],
} satisfies NextAuthConfig;
