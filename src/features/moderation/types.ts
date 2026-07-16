/**
 * Sdílené typy a číselníky moderace (T036).
 *
 * Hodnoty enumů zrcadlí `prisma/schema.prisma` (ReportTargetType, ReportReason,
 * ReportState, ModerationActionType, ContentModerationState) — jsou jediným
 * zdrojem pro Zod validaci, stavový automat i UI popisky. Modul je čistý (bez
 * DB / `next/*`), aby ho šlo použít i v klientských komponentách (sdílené
 * tlačítko „Nahlásit" embedované konzumujícími doménami).
 */

// --- Cíl reportu -------------------------------------------------------------

export const REPORT_TARGET_TYPES = [
  "profile",
  "portfolio_project",
  "request",
  "message",
  "review",
  "request_response",
] as const;
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

export const REPORT_TARGET_TYPE_LABELS: Record<ReportTargetType, string> = {
  profile: "Profil",
  portfolio_project: "Portfolio",
  request: "Poptávka",
  message: "Zpráva",
  review: "Recenze",
  request_response: "Reakce na poptávku",
};

// --- Důvod ---------------------------------------------------------------

/**
 * Zadani/12 §4 — Reportable content. `review_dispute` je interní důvod pro
 * formální spor hodnoceného nad recenzí (T037 § Main flow bod 6) — NENÍ
 * v `GENERIC_REPORT_REASONS`, vzniká jen z vyhrazeného dispute flow
 * (`features/reviews/service.ts` → `disputeReview`), ne z volby v obecném
 * „Nahlásit" dialogu.
 */
export const REPORT_REASONS = [
  "spam",
  "scam",
  "fake_identity",
  "harassment",
  "dangerous_advice",
  "copyright",
  "impersonation",
  "illegal_solicitation",
  "review_dispute",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam: "Spam",
  scam: "Podvod",
  fake_identity: "Falešná identita",
  harassment: "Obtěžování",
  dangerous_advice: "Nebezpečná rada",
  copyright: "Porušení autorských práv",
  impersonation: "Vydávání se za jiného",
  illegal_solicitation: "Nelegální nabídka",
  review_dispute: "Spor o hodnocení (právo na reakci)",
};

/** Důvody nabízené v OBECNÉM „Nahlásit" dialogu (`ReportButton`) — vynechává
 * `review_dispute`, který vzniká jen z vyhrazeného dispute flow (T037). */
export const GENERIC_REPORT_REASONS: readonly ReportReason[] =
  REPORT_REASONS.filter((r) => r !== "review_dispute");

// --- Stav reportu ----------------------------------------------------------

/** Zadani/12 §5 — Moderation states. Přechody viz `state-machine.ts`. */
export const REPORT_STATES = [
  "open",
  "triaged",
  "under_review",
  "actioned",
  "dismissed",
  "appealed",
  "closed",
] as const;
export type ReportState = (typeof REPORT_STATES)[number];

export const REPORT_STATE_LABELS: Record<ReportState, string> = {
  open: "Nové",
  triaged: "Zařazeno",
  under_review: "V řešení",
  actioned: "Vyřešeno — zásah",
  dismissed: "Zamítnuto",
  appealed: "Odvoláno",
  closed: "Uzavřeno",
};

/** Stavy, ve kterých se nový report na stejný cíl PŘIPOJÍ (nevzniká nový). */
export const OPEN_REPORT_STATES: readonly ReportState[] = [
  "open",
  "triaged",
  "under_review",
];

// --- Moderační akce ----------------------------------------------------------

/** Zadani/12 §6 — Actions. */
export const MODERATION_ACTION_TYPES = [
  "no_action",
  "warning",
  "content_hide",
  "content_remove",
  "feature_restriction",
  "suspend_temporary",
  "suspend_permanent",
] as const;
export type ModerationActionType = (typeof MODERATION_ACTION_TYPES)[number];

export const MODERATION_ACTION_LABELS: Record<ModerationActionType, string> = {
  no_action: "Bez zásahu (zamítnout)",
  warning: "Upozornění uživateli",
  content_hide: "Skrýt obsah",
  content_remove: "Odstranit obsah",
  feature_restriction: "Omezení funkce",
  suspend_temporary: "Dočasná suspenze účtu",
  suspend_permanent: "Trvalá suspenze účtu",
};

/** Akce, které reálně zasahují proti obsahu/účtu (výsledný stav `actioned`). */
export const INTERVENING_ACTIONS: readonly ModerationActionType[] = [
  "warning",
  "content_hide",
  "content_remove",
  "feature_restriction",
  "suspend_temporary",
  "suspend_permanent",
];

/** Akce, které mění moderační stav CÍLE na `hidden` (§ States). */
export const HIDING_ACTIONS: readonly ModerationActionType[] = [
  "content_hide",
  "content_remove",
];

// --- Stav cílové entity ------------------------------------------------------

export const CONTENT_MODERATION_STATES = ["visible", "hidden"] as const;
export type ContentModerationState = (typeof CONTENT_MODERATION_STATES)[number];

// --- Pohledy pro UI ----------------------------------------------------------

/** Položka moderační fronty (výpis s filtry). */
export interface ReportListItem {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  state: ReportState;
  /** Kolik odlišných uživatelů tento cíl nahlásilo (agregace duplicit). */
  reporterCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Jedno podané nahlášení v rámci případu. */
export interface ReportSubmissionView {
  id: string;
  reporterUserId: string;
  reason: ReportReason;
  note: string | null;
  createdAt: string;
}

/** Auditní záznam moderační akce. */
export interface ModerationActionView {
  id: string;
  moderatorUserId: string | null;
  actionType: ModerationActionType;
  reason: string;
  createdAt: string;
}

/** Krátký náhled nahlášeného obsahu (jen nezbytný kontext, ne celá historie). */
export type TargetPreview =
  | {
      kind: "message";
      messageId: string;
      conversationId: string;
      senderUserId: string;
      content: string;
      createdAt: string;
      /** Bezprostřední okolí (pár zpráv před/po), NE celá konverzace. */
      context: {
        id: string;
        senderUserId: string;
        content: string;
        createdAt: string;
      }[];
    }
  | { kind: "profile"; ownerUserId: string; title: string; href: string | null }
  | {
      kind: "portfolio_project";
      ownerUserId: string | null;
      title: string;
      href: string | null;
    }
  | { kind: "request"; ownerUserId: string; title: string; href: string }
  | {
      kind: "request_response";
      /** `null` u firemní reakce (org-authored — stejný princip jako portfolio). */
      ownerUserId: string | null;
      title: string;
      href: string;
    }
  | {
      kind: "review";
      /** `null` po smazání účtu recenzenta (anonymizováno, T037 § Alternative flows). */
      reviewerUserId: string | null;
      /** Jméno/headline hodnoceného profesionála, nebo název firmy. */
      targetLabel: string;
      averageRating: number;
      text: string | null;
    }
  | { kind: "unavailable" };

/** Detail případu pro admin frontu: report + podání + akce + historie + náhled. */
export interface ReportDetailView {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  note: string | null;
  state: ReportState;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  submissions: ReportSubmissionView[];
  actions: ModerationActionView[];
  preview: TargetPreview;
  /** Moderační stav cíle (visible/hidden) — nezávislý na stavu případu. */
  targetModerationState: ContentModerationState;
  /** Další (starší) reporty na TENTÝŽ cíl — kontext opakovaných problémů. */
  targetHistory: ReportListItem[];
  /** Historie reportů PODANÝCH prvním reporterem tohoto případu (§ Edge cases —
   * falešné/šikanózní reporty musí být moderátorovi viditelné). */
  firstReporterHistory: ReportListItem[];
}

export const REPORT_QUEUE_MAX_ITEMS = 50;

// --- Integrace konzumujících domén ------------------------------------------

/**
 * Důvody nabízené u nahlášení ZPRÁVY (T031). Podmnožina relevantní pro
 * konverzace (phishing spadá pod „podvod"); ostatní důvody (autorská práva u
 * portfolia apod.) nabízí příslušná doména. Pořadí = pořadí v UI.
 */
export const MESSAGE_REPORT_REASONS: readonly ReportReason[] = [
  "spam",
  "scam",
  "harassment",
  "dangerous_advice",
  "impersonation",
  "illegal_solicitation",
] as const;

/** Maximální délka volitelného popisu/poznámky reportu (sdílené UI + validace). */
export const REPORT_NOTE_MAX_LENGTH = 1000;
