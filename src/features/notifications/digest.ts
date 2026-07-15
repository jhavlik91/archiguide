import type { EmailFrequency } from "./types";

/**
 * Čistá (bez DB) logika periodického digestu (T033 § Main flow bod 4–5).
 * Frekvence `"immediate"` nemá vlastní periodu — digest se týká jen `"daily"`
 * a `"weekly"`, proto vlastní užší typ.
 */
export type DigestFrequency = Exclude<EmailFrequency, "immediate">;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** ISO 8601 týden (`YYYY-Www`, UTC) — stabilní i kolem přelomu roku. */
function isoWeekKey(date: Date): string {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );
  return `${d.getUTCFullYear()}-W${pad2(weekNo)}`;
}

/**
 * Idempotenční klíč periody pro danou frekvenci a čas (UTC). Stejný den/týden
 * → stejný klíč → opakovaný cron běh narazí na unikátní index a nic nepošle
 * znovu (T033 § Edge cases — "duplicitní cron běh → idempotence").
 */
export function digestPeriodKey(frequency: DigestFrequency, now: Date): string {
  return frequency === "daily" ? now.toISOString().slice(0, 10) : isoWeekKey(now);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Začátek okna, za které digest shrnuje aktivitu. */
export function digestWindowStart(frequency: DigestFrequency, now: Date): Date {
  const days = frequency === "daily" ? 1 : 7;
  return new Date(now.getTime() - days * DAY_MS);
}
