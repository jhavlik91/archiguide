/**
 * Sdílené typy a katalog notifikačního systému (T032).
 *
 * Modul je čistý (bez DB / `next/*` / `node:*`), aby ho šlo použít i v klientských
 * komponentách (zvoneček, seznam) i na serveru (emit, queries). Katalog událostí
 * je JEDINÝ zdroj pravdy pro validaci typu, default priority a kanálovou politiku.
 */

/** Priorita notifikace. Zrcadlí enum `NotificationPriority` v schema.prisma. */
export const NOTIFICATION_PRIORITIES = [
  "low",
  "normal",
  "high",
  "urgent",
] as const;
export type NotificationPriority = (typeof NOTIFICATION_PRIORITIES)[number];

/** Stav notifikace. Zrcadlí enum `NotificationState` v schema.prisma. */
export const NOTIFICATION_STATES = ["unread", "read"] as const;
export type NotificationState = (typeof NOTIFICATION_STATES)[number];

/** Doručovací kanály (zadani/11 — Kanály). V MVP se materializuje jen `in_app`. */
export const NOTIFICATION_CHANNELS = ["in_app", "email", "sms", "push"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

/**
 * Definice jednoho typu události v katalogu. `channels` je DEFAULT kanálová
 * politika (zadani/11 — Default channel policy): kanály značené „Y" jsou zapnuté,
 * podmíněné („C") jsou opt-in (default vypnuté, zapne je až preference z T033).
 * SMS defaultně nikdy (zadani/11 — Pravidla).
 */
export type EventDefinition = {
  priority: NotificationPriority;
  channels: readonly NotificationChannel[];
};

/**
 * Katalog notifikačních událostí (MVP rozsah dle T032 § Main flow bod 6). Enum je
 * OTEVŘENÝ pro rozšíření — nový typ = jen záznam zde, DB drží prostý string (žádná
 * migrace, žádný hardcode na jednu doménu). `emit` validuje typ proti tomuto katalogu.
 */
export const EVENT_CATALOG = {
  // Messaging (T030)
  new_message: { priority: "normal", channels: ["in_app"] },
  // Marketplace (T027 a dále)
  new_response: { priority: "high", channels: ["in_app", "email"] },
  response_viewed: { priority: "low", channels: ["in_app"] },
  shortlisted: { priority: "normal", channels: ["in_app"] },
  response_accepted: { priority: "high", channels: ["in_app", "email"] },
  response_rejected: { priority: "normal", channels: ["in_app"] },
  request_paused: { priority: "normal", channels: ["in_app"] },
  request_closed: { priority: "normal", channels: ["in_app"] },
  // Matching (T024+)
  new_recommendation: { priority: "normal", channels: ["in_app"] },
  recommended_request: { priority: "normal", channels: ["in_app"] },
  // Verifikace (T011)
  verification_pending: { priority: "low", channels: ["in_app"] },
  verification_approved: { priority: "high", channels: ["in_app", "email"] },
  verification_rejected: { priority: "high", channels: ["in_app", "email"] },
  verification_expiring: { priority: "high", channels: ["in_app", "email"] },
} as const satisfies Record<string, EventDefinition>;

/** Typ události z katalogu (pro volající s typovou nápovědou; DB drží string). */
export type NotificationEventType = keyof typeof EVENT_CATALOG;

/**
 * Notifikační preference uživatele (uložené v `User.notificationPreferences`).
 * Preferenční UI je T033 — zde jen respektujeme uložené hodnoty s defaulty dle
 * kanálové politiky. Přepis per událost má přednost před globálním kanálem.
 */
export type NotificationPreferences = {
  /** Globální zapnutí/vypnutí kanálu. */
  channels?: Partial<Record<NotificationChannel, boolean>>;
  /** Přepis per typ události (přednost před `channels`). */
  events?: Record<string, Partial<Record<NotificationChannel, boolean>>>;
};

/** Serializovatelný pohled na notifikaci pro UI (zvoneček i stránka). */
export type NotificationView = {
  id: string;
  eventType: string;
  title: string;
  reason: string;
  /** Cíl kliknutí — relativní cesta do kontextu. */
  href: string;
  priority: NotificationPriority;
  /** Je nepřečtená? */
  unread: boolean;
  /** Kolik událostí se sloučilo (pro „Nová zpráva ×5"). */
  count: number;
  createdAt: string;
};

/** Datový balík pro notifikační centrum (zvoneček): počet + posledních N položek. */
export type NotificationCentre = {
  unreadCount: number;
  items: NotificationView[];
};

/** Kolik posledních notifikací zobrazí zvoneček (stránka `/notifications` vše). */
export const NOTIFICATION_BELL_LIMIT = 15;
