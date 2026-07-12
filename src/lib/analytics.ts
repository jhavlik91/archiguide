/**
 * Minimalistická analytická vrstva. MVP jen strukturovaně loguje eventy na
 * server; napojení na reálný sink (např. product analytics) přijde později.
 * Držíme názvy eventů centrálně, aby se daly typově kontrolovat.
 */

export type AnalyticsEvent =
  | "auth.registered"
  | "auth.login"
  | "auth.password_reset"
  | "role.context_switched"
  // Profesionální profil (T007)
  | "profile.created"
  | "profile.published"
  | "profile.accepting_requests_toggled"
  // Veřejná stránka profilu (T008)
  | "profile.viewed"
  // Organizace (T009)
  | "org.created"
  | "org.member_invited"
  | "org.member_joined"
  // Organizace — veřejná stránka (T010)
  | "org.viewed"
  // Verifikace (T011)
  | "verification.email_completed"
  | "verification.phone_completed"
  // Portfolio (T012)
  | "portfolio.created"
  | "portfolio.published"
  // Portfolio — blokový editor (T013)
  | "portfolio.block_added"
  | "portfolio.preview_used"
  // Média (T014)
  | "media.uploaded"
  // Portfolio — veřejná stránka (T016)
  | "portfolio.viewed";

export function trackEvent(
  event: AnalyticsEvent,
  properties: Record<string, unknown> = {},
): void {
  // Strukturovaný log; v produkci nahradí odeslání do analytického sinku.
  console.info(JSON.stringify({ type: "analytics", event, ...properties }));
}
