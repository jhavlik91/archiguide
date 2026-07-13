/**
 * Sdílené typy a číselníky messaging systému (T030).
 *
 * Modul je čistý (bez DB / `next/*` / `node:*`), aby ho šlo použít v klientských
 * komponentách (inbox, vlákno, composer) i na serveru. Konstanty (max délka
 * zprávy, velikost stránky) jsou jediným zdrojem pro validaci i UI.
 */

/** Maximální délka jedné zprávy (znaky). Sdílené klientem i Zod validací. */
export const MESSAGE_MAX_LENGTH = 5000;

/** Kolik zpráv se načte na jednu stránku vlákna (nejnovější první, pak reverz). */
export const MESSAGES_PAGE_SIZE = 40;

/** Moderační stav zprávy. Zrcadlí enum `MessageModerationState` v schema.prisma. */
export const MESSAGE_MODERATION_STATES = ["visible", "hidden"] as const;
export type MessageModerationState = (typeof MESSAGE_MODERATION_STATES)[number];

/**
 * Polymorfní kontext vzniku konverzace (typ domény + ID entity), nebo `null` pro
 * přímou konverzaci. Bez FK na cizí model — vazbu zná zdrojová doména.
 */
export type ConversationContext = {
  /** Typ domény, např. `request`, `response`, `profile`. */
  type: string;
  /** ID entity v dané doméně. */
  id: string;
};

/**
 * Lidsky čitelné popisky známých typů kontextu (hlavička konverzace). Neznámý typ
 * spadne na obecné „Konverzace" — messaging nezná detaily cizích domén.
 */
export const CONTEXT_LABELS: Record<string, string> = {
  request: "Poptávka",
  response: "Reakce na poptávku",
  profile: "Profil profesionála",
  portfolio: "Portfolio",
};

/** Popisek kontextu pro hlavičku vlákna (`null` = přímá konverzace bez kontextu). */
export function contextLabel(type: string | null | undefined): string | null {
  if (!type) return null;
  return CONTEXT_LABELS[type] ?? "Konverzace";
}

/**
 * Serializovatelná identita účastníka pro zobrazení. Zrušený účet (`deleted`)
 * dostane placeholder popisek bez odkazu (zadani/09 — Messaging); jinak se
 * použije titulek profesního profilu, případně lokální část e-mailu.
 */
export type ParticipantIdentity = {
  userId: string;
  /** Zobrazovaný popisek (titulek profilu / handle / „Zrušený účet"). */
  label: string;
  /** Odkaz na veřejný profil, je-li publikovaný; jinak `null`. */
  href: string | null;
  /** Účet byl zrušen → placeholder identita, odeslání do konverzace blokované. */
  deleted: boolean;
};

/** Odkaz na zprávu, na kterou se odpovídá (reply reference) — zkrácený náhled. */
export type ReplyReference = {
  id: string;
  /** Popisek odesílatele původní zprávy. */
  authorLabel: string;
  /** Zkrácený náhled obsahu původní zprávy. */
  excerpt: string;
};

/** Serializovatelný pohled na zprávu ve vlákně. */
export type MessageView = {
  id: string;
  conversationId: string;
  /** Obsah se v UI renderuje VŽDY jako text (XSS: nikdy HTML). U skryté `null`. */
  content: string | null;
  /** Skrytá moderátorem (T036) → UI vykreslí placeholder místo obsahu. */
  hidden: boolean;
  sender: ParticipantIdentity;
  /** Poslal ji přihlášený divák? (zarovnání, „přečteno" se počítá jen cizím). */
  mine: boolean;
  createdAt: string;
  /** Idempotenční token z klienta — pro slučování optimistických zpráv. */
  clientToken: string;
  replyTo: ReplyReference | null;
};

/** Popisek kontextu konverzace pro hlavičku (typ + volitelný odkaz). */
export type ConversationContextView = {
  type: string;
  label: string;
};

/** Položka inboxu — přehled jedné konverzace. */
export type ConversationSummary = {
  id: string;
  /** Druhý účastník 1:1 konverzace. */
  other: ParticipantIdentity;
  context: ConversationContextView | null;
  /** Náhled poslední zprávy (`null` = konverzace zatím bez zpráv). */
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  /** Počet nepřečtených zpráv pro diváka. */
  unreadCount: number;
  /** Archivováno divákem (per-účastník). */
  archived: boolean;
};

/** Detail konverzace pro vlákno (hlavička + zprávy + stav odeslání). */
export type ConversationDetail = {
  id: string;
  viewerUserId: string;
  other: ParticipantIdentity;
  context: ConversationContextView | null;
  messages: MessageView[];
  /** Jsou k dispozici starší zprávy nad rámec načtené stránky? */
  hasMoreOlder: boolean;
  /** Smí divák do konverzace psát? (účastník + protistrana není zrušená/deakt.). */
  canSend: boolean;
  /** Vysvětlení, proč je odeslání zablokované (`null` = lze psát). */
  blockedReason: string | null;
};

/** Zkrátí text na náhled (inbox, reply reference) bez rozseknutí uprostřed slova. */
export function toPreview(content: string, max = 120): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return normalized.slice(0, max - 1).trimEnd() + "…";
}
