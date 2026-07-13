/**
 * Formátování času pro messaging UI (T030). Čistý modul (sdílený inbox + vlákno).
 */

const timeFmt = new Intl.DateTimeFormat("cs-CZ", {
  hour: "2-digit",
  minute: "2-digit",
});

const dateFmt = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
});

/** Iniciály z popisku (max 2 znaky) pro avatar fallback. */
export function initials(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/** Čas zprávy ve vlákně (HH:MM). */
export function formatTime(iso: string): string {
  return timeFmt.format(new Date(iso));
}

/**
 * Krátký časový údaj pro inbox: dnes → čas, jinak datum. `null` (bez zpráv) → "".
 */
export function formatInboxTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  return sameDay ? timeFmt.format(d) : dateFmt.format(d);
}
