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

/** Doručovací kanály (zadani/11 — Kanály). V MVP se materializují `in_app` a `email`. */
export const NOTIFICATION_CHANNELS = ["in_app", "email", "sms", "push"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

/**
 * Skupina událostí pro preferenční UI (T033 § Main flow bod 3 — „matice
 * událost-skupina × kanál"). Jemnější než kanálová politika, hrubší než
 * jednotlivý typ události — uživatel nastavuje kanál/frekvenci za skupinu,
 * ne za desítky typů. Odpovídá doménovým sekcím v `zadani/11-notifications.md`.
 */
export const NOTIFICATION_GROUPS = [
  "messaging",
  "marketplace",
  "matching",
  "verification",
] as const;
export type NotificationGroup = (typeof NOTIFICATION_GROUPS)[number];

/** České popisky skupin pro preferenční UI a e-mailovou patičku. */
export const NOTIFICATION_GROUP_LABELS: Record<NotificationGroup, string> = {
  messaging: "Zprávy",
  marketplace: "Poptávky a reakce",
  matching: "Doporučení",
  verification: "Verifikace účtu",
};

/** Frekvence e-mailových notifikací (zadani/legacy-master-spec §28.2). */
export const EMAIL_FREQUENCIES = ["immediate", "daily", "weekly"] as const;
export type EmailFrequency = (typeof EMAIL_FREQUENCIES)[number];

/**
 * Definice jednoho typu události v katalogu. `channels` je DEFAULT kanálová
 * politika (zadani/11 — Default channel policy): kanály značené „Y" jsou zapnuté,
 * podmíněné („C") jsou opt-in (default vypnuté, zapne je až preference z T033).
 * SMS defaultně nikdy (zadani/11 — Pravidla). `critical` = kritická servisní
 * událost, u které nejde in-app kanál vypnout preferencí (T033 § Main flow bod 3).
 */
export type EventDefinition = {
  priority: NotificationPriority;
  channels: readonly NotificationChannel[];
  group: NotificationGroup;
  critical?: boolean;
};

/**
 * Katalog notifikačních událostí (MVP rozsah dle T032 § Main flow bod 6). Enum je
 * OTEVŘENÝ pro rozšíření — nový typ = jen záznam zde, DB drží prostý string (žádná
 * migrace, žádný hardcode na jednu doménu). `emit` validuje typ proti tomuto katalogu.
 */
export const EVENT_CATALOG = {
  // Messaging (T030)
  new_message: { priority: "normal", channels: ["in_app"], group: "messaging" },
  // Marketplace (T027 a dále)
  new_response: { priority: "high", channels: ["in_app", "email"], group: "marketplace" },
  response_viewed: { priority: "low", channels: ["in_app"], group: "marketplace" },
  shortlisted: { priority: "normal", channels: ["in_app"], group: "marketplace" },
  response_accepted: { priority: "high", channels: ["in_app", "email"], group: "marketplace" },
  response_rejected: { priority: "normal", channels: ["in_app"], group: "marketplace" },
  request_paused: { priority: "normal", channels: ["in_app"], group: "marketplace" },
  request_closed: { priority: "normal", channels: ["in_app"], group: "marketplace" },
  // Matching (T024+)
  new_recommendation: { priority: "normal", channels: ["in_app"], group: "matching" },
  recommended_request: { priority: "normal", channels: ["in_app"], group: "matching" },
  // Verifikace (T011) — schválení/zamítnutí/vypršení jsou kritické servisní stavy účtu.
  verification_pending: { priority: "low", channels: ["in_app"], group: "verification" },
  verification_approved: {
    priority: "high",
    channels: ["in_app", "email"],
    group: "verification",
    critical: true,
  },
  verification_rejected: {
    priority: "high",
    channels: ["in_app", "email"],
    group: "verification",
    critical: true,
  },
  verification_expiring: {
    priority: "high",
    channels: ["in_app", "email"],
    group: "verification",
    critical: true,
  },
} as const satisfies Record<string, EventDefinition>;

/** Typ události z katalogu (pro volající s typovou nápovědou; DB drží string). */
export type NotificationEventType = keyof typeof EVENT_CATALOG;

/**
 * Notifikační preference uživatele (uložené v `User.notificationPreferences`).
 * Přepis per událost má přednost před per-skupinou, per-skupina před globálním
 * kanálem (viz `resolveChannels`). `emailFrequency` řídí, zda e-maily chodí
 * okamžitě, nebo se odloží do denního/týdenního digestu (T033).
 */
export type NotificationPreferences = {
  /** Globální zapnutí/vypnutí kanálu. */
  channels?: Partial<Record<NotificationChannel, boolean>>;
  /** Přepis per skupina (preferenční UI matice skupina × kanál, T033). */
  groups?: Partial<Record<NotificationGroup, Partial<Record<NotificationChannel, boolean>>>>;
  /** Přepis per typ události (nejvyšší přednost). */
  events?: Record<string, Partial<Record<NotificationChannel, boolean>>>;
  /** Frekvence e-mailového kanálu. Chybí-li, chová se jako `"immediate"`. */
  emailFrequency?: EmailFrequency;
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
  /**
   * Čas POSLEDNÍ události v notifikaci — tedy to, podle čeho centrum řadí. Dedup
   * bump ho posune, takže sloučená notifikace ukazuje čas nejnovější události, ne
   * té první (jinak by položka nahoře nesla nejstarší čas v seznamu).
   */
  lastEventAt: string;
};

/** Datový balík pro notifikační centrum (zvoneček): počet + posledních N položek. */
export type NotificationCentre = {
  unreadCount: number;
  items: NotificationView[];
};

/** Kolik posledních notifikací zobrazí zvoneček (stránka `/notifications` vše). */
export const NOTIFICATION_BELL_LIMIT = 15;
