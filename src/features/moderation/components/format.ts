/** Formátování data/času pro admin moderační UI (T036). */

const dateTimeFmt = new Intl.DateTimeFormat("cs-CZ", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatDateTime(iso: string): string {
  return dateTimeFmt.format(new Date(iso));
}
