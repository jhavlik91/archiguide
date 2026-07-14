/**
 * Formátování času pro notifikační UI (T032). Čistý modul (sdílí zvoneček i stránka).
 */

const dateTimeFmt = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Relativní čas notifikace („teď", „před 5 min", „před 3 h", „včera"), pro starší
 * plné datum a čas. Drží krátký, srozumitelný údaj bez závislosti na knihovně.
 */
export function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const min = Math.floor(diffMs / 60_000);

  if (min < 1) return "teď";
  if (min < 60) return `před ${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `před ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "včera";
  if (days < 7) return `před ${days} dny`;
  return dateTimeFmt.format(new Date(iso));
}
