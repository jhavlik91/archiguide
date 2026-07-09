import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { Account, Profile } from "next-auth";
import { authConfig } from "@/auth.config";
import { db } from "@/lib/db";
import { normalizeEmail } from "@/lib/email";
import { verifyPassword } from "@/features/auth/password";
import { decideGoogleLink } from "@/features/auth/account-linking";

/**
 * Plná konfigurace Auth.js (Node runtime). Přidává Credentials provider a
 * callbacky, které sahají do DB — proto se nesmí importovat do middleware
 * (viz `src/auth.config.ts`). Session je JWT, žádný DB adapter nepoužíváme:
 * propojení OAuth účtů řešíme ručně v `jwt`/`signIn` callbacích.
 */

/** Vyřeší (nebo založí) našeho uživatele pro přihlášení přes Google. */
async function resolveGoogleUser(
  profile: Profile | undefined,
  account: Account,
): Promise<string | null> {
  const email = normalizeEmail(String(profile?.email ?? ""));
  if (!email) return null;
  const providerAccountId = String(account.providerAccountId);

  const existing = await db.user.findUnique({ where: { email } });
  const decision = decideGoogleLink(existing);
  if (decision === "block") return null;

  if (decision === "create") {
    const created = await db.user.create({
      data: {
        email,
        authAccounts: { create: { provider: "google", providerAccountId } },
      },
    });
    return created.id;
  }

  // Existující účet: případně reaktivovat a doplnit vazbu na Google.
  if (decision === "reactivate") {
    await db.user.update({
      where: { id: existing!.id },
      data: { status: "active" },
    });
  }
  await db.authAccount.upsert({
    where: {
      provider_providerAccountId: { provider: "google", providerAccountId },
    },
    create: { provider: "google", providerAccountId, userId: existing!.id },
    update: {},
  });
  return existing!.id;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    ...authConfig.providers,
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Heslo", type: "password" },
      },
      authorize: async (credentials) => {
        const email = normalizeEmail(String(credentials?.email ?? ""));
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        const user = await db.user.findUnique({
          where: { email },
          include: { credential: true },
        });
        // Bez hesla (jen Google účet), smazaný nebo deaktivovaný → nelze.
        if (!user?.credential) return null;
        if (user.status !== "active") return null;

        const ok = await verifyPassword(password, user.credential.passwordHash);
        if (!ok) return null;

        return { id: user.id, email: user.email };
      },
    }),
  ],
  callbacks: {
    // Smazaný účet nesmí získat session ani přes Google.
    async signIn({ account, profile }) {
      if (account?.provider === "google") {
        const email = normalizeEmail(String(profile?.email ?? ""));
        if (!email) return false;
        const existing = await db.user.findUnique({ where: { email } });
        return decideGoogleLink(existing) !== "block";
      }
      return true;
    },
    async jwt({ token, user, account, profile }) {
      if (user?.id) token.sub = user.id;
      if (account?.provider === "google") {
        const resolvedId = await resolveGoogleUser(profile, account);
        if (resolvedId) token.sub = resolvedId;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.sub && session.user) session.user.id = token.sub;
      return session;
    },
  },
});
