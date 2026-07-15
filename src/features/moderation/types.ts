/**
 * Sdílené typy a číselníky nahlašování obsahu (T031, rozšiřuje T036).
 *
 * Modul je čistý (bez DB / `next/*`), aby ho šlo použít v klientských
 * komponentách (dialog nahlášení) i na serveru. Enumy zrcadlí `schema.prisma`
 * (`ReportTargetType`, `ReportReason`, `ReportState`) a jsou jediným zdrojem pro
 * validaci i UI.
 *
 * T031 zakládá jen reporty zpráv ve stavu `open`; moderační frontu, přechody
 * stavů a akce řeší T036 (append-only rozšíření nad týmž modelem).
 */

/** Typ nahlašitelného cíle (polymorfně). Zrcadlí `ReportTargetType`. */
export const REPORT_TARGET_TYPES = [
  "profile",
  "portfolio_project",
  "request",
  "message",
  "review",
] as const;
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

/** Důvod nahlášení (zadani/12 §4). Zrcadlí `ReportReason`. */
export const REPORT_REASONS = [
  "spam",
  "scam",
  "fake_identity",
  "harassment",
  "dangerous_advice",
  "copyright",
  "impersonation",
  "illegal_solicitation",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** Stav reportu (zadani/12 §5). Zrcadlí `ReportState`. */
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

/** Lidsky čitelné popisky důvodů (dialog nahlášení). */
export const REPORT_REASON_LABEL: Record<ReportReason, string> = {
  spam: "Spam",
  scam: "Podvod",
  fake_identity: "Falešná identita",
  harassment: "Obtěžování",
  dangerous_advice: "Nebezpečná rada",
  copyright: "Porušení autorských práv",
  impersonation: "Vydávání se za jiného",
  illegal_solicitation: "Nezákonná nabídka",
};

/**
 * Důvody nabízené u nahlášení ZPRÁVY. Podmnožina relevantní pro konverzace
 * (phishing spadá pod „podvod"); ostatní důvody (autorská práva u portfolia
 * apod.) přidá příslušná doména v T036. Pořadí = pořadí v UI.
 */
export const MESSAGE_REPORT_REASONS: readonly ReportReason[] = [
  "spam",
  "scam",
  "harassment",
  "dangerous_advice",
  "impersonation",
  "illegal_solicitation",
] as const;

/** Maximální délka volitelného popisu reportu. */
export const REPORT_NOTE_MAX_LENGTH = 1000;
