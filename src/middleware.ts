import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

// Middleware používá jen edge-safe konfiguraci (bez Credentials/DB), takže
// pouze čte stav session z JWT cookie.
const { auth } = NextAuth(authConfig);

/**
 * Prefixy odpovídající skupinám `(app)` a `(admin)`. Route groups z URL mizí,
 * proto je držíme explicitně. Nová chráněná sekce = přidat prefix sem.
 * `(public)` routy se nechrání nikdy (T003 § Middleware).
 */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/requests",
  "/messages",
  "/portfolio",
  "/profile",
  "/organizations",
  "/settings",
  "/guide",
  "/admin",
];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export default auth((req) => {
  const { nextUrl } = req;
  if (!isProtected(nextUrl.pathname)) return NextResponse.next();
  if (req.auth) return NextResponse.next();

  // Nepřihlášený → login se zachováním návratové URL (T003 § Permissions).
  const loginUrl = new URL("/login", nextUrl);
  loginUrl.searchParams.set("returnUrl", nextUrl.pathname + nextUrl.search);
  return NextResponse.redirect(loginUrl);
});

export const config = {
  // Vynecháme statická aktiva a auth API; zbytek prochází middlewarem.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
