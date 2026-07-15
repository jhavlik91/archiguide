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
  // Úpravy obrázků (T015)
  | "media.edited"
  // Portfolio — veřejná stránka (T016)
  | "portfolio.viewed"
  // Guide (T017)
  | "guide.started"
  | "guide.step_answered"
  | "guide.completed"
  | "guide.abandoned"
  // Guide — UI runner (T018)
  | "guide.scenario_selected"
  | "guide.resumed"
  // Guide — shrnutí, rozpory, bezpečnostní warningy (T020)
  | "guide.summary_viewed"
  | "guide.conflict_shown"
  | "guide.safety_warning_shown"
  // Attachment systém (T023)
  | "attachment.uploaded"
  | "attachment.visibility_changed"
  // Brief — generování z guide (T021)
  | "brief.created"
  | "brief.regenerated"
  | "brief.ready"
  // Brief — editace, sdílení, export (T022)
  | "brief.edited"
  | "brief.shared"
  | "brief.share_revoked"
  | "brief.exported"
  | "brief.archived"
  // Messaging — core (T030)
  | "messaging.conversation_started"
  | "messaging.message_sent"
  // Messaging — přílohy, blokace, nahlášení (T031)
  | "messaging.attachment_sent"
  | "messaging.conversation_blocked"
  | "messaging.message_reported"
  // Notifikace — event systém + in-app (T032)
  | "notification.created"
  | "notification.opened"
  // Notifikace — e-mail, preference, digest (T033)
  | "email_sent"
  | "email_unsubscribed"
  | "digest_sent"
  // Vyhledávání profesionálů (T034)
  | "search_performed"
  | "search_result_clicked"
  | "search_empty"
  // Poptávka — CRUD + stavový model (T024)
  | "request.created"
  | "request.published"
  | "request.discussion_started"
  | "request.paused"
  | "request.resumed"
  | "request.awarded"
  | "request.closed"
  | "request.cancelled"
  | "request.expired"
  // Poptávka — viditelnost + anonymizace (T025)
  | "request.visibility_changed"
  | "request.privacy_warning_shown"
  // Poptávky — výpis + detail (T026) — jména dle tasku (§ Analytics), ne dotted konvence.
  | "request_viewed"
  | "request_list_filtered"
  // Matching engine (T028) — jména dle tasku (§ Analytics), ne dotted konvence.
  | "match_computed"
  | "match_dismissed"
  | "match_shortlisted"
  // Administrace — uživatelé a taxonomie (T035)
  | "admin_user_suspended"
  | "admin_role_changed"
  | "admin_taxonomy_changed"
  // Moderace (T036, zadani/14 — Trust)
  | "report_created"
  | "report_actioned"
  | "report_dismissed";

export function trackEvent(
  event: AnalyticsEvent,
  properties: Record<string, unknown> = {},
): void {
  // Strukturovaný log; v produkci nahradí odeslání do analytického sinku.
  console.info(JSON.stringify({ type: "analytics", event, ...properties }));
}
