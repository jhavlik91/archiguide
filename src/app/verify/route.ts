import { NextResponse } from "next/server";
import { trackEvent } from "@/lib/analytics";
import { confirmEmailToken } from "@/features/verification/service";

/**
 * Potvrzení e-mailu z verifikačního odkazu (T011). Token sám identifikuje výzvu,
 * takže potvrzení nevyžaduje přihlášení. Po vyhodnocení přesměruje na Nastavení
 * se stavem ve query (přihlášení případně vynutí middleware).
 */
export async function GET(request: Request): Promise<NextResponse> {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/settings?verifyError=1", request.url));
  }

  const result = await confirmEmailToken(token);
  if (result.ok) {
    trackEvent("verification.email_completed", { userId: result.userId });
    return NextResponse.redirect(new URL("/settings?emailVerified=1", request.url));
  }

  return NextResponse.redirect(
    new URL(`/settings?verifyError=${result.reason}`, request.url),
  );
}
