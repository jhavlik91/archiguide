import { NextResponse } from "next/server";
import { trackEvent } from "@/lib/analytics";
import { disableGroupEmail, resetEmailFrequency } from "@/features/notifications/service";
import {
  DIGEST_UNSUBSCRIBE_TARGET,
  verifyUnsubscribeToken,
} from "@/features/notifications/unsubscribe-token";

/**
 * One-click unsubscribe z patičky notifikačního e-mailu (T033 § Alternative
 * flows). Token sám nese identitu a cíl, takže funguje bez přihlášení a je
 * idempotentní (opakovaný klik je no-op). Přesměruje na Nastavení se stavem
 * ve query — stejný vzor jako `/verify` (T011).
 */
export async function GET(request: Request): Promise<NextResponse> {
  const token = new URL(request.url).searchParams.get("token");
  const payload = token ? verifyUnsubscribeToken(token) : null;

  if (!payload) {
    return NextResponse.redirect(
      new URL("/settings?unsubscribeError=1", request.url),
    );
  }

  if (payload.target === DIGEST_UNSUBSCRIBE_TARGET) {
    await resetEmailFrequency(payload.userId);
  } else {
    await disableGroupEmail(payload.userId, payload.target);
  }
  trackEvent("email_unsubscribed", { target: payload.target });

  return NextResponse.redirect(
    new URL(`/settings?unsubscribed=${payload.target}`, request.url),
  );
}
