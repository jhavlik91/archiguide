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
  | "profile.accepting_requests_toggled";

export function trackEvent(
  event: AnalyticsEvent,
  properties: Record<string, unknown> = {},
): void {
  // Strukturovaný log; v produkci nahradí odeslání do analytického sinku.
  console.info(JSON.stringify({ type: "analytics", event, ...properties }));
}
