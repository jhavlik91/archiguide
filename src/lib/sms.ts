import "server-only";

/**
 * Odesílání SMS pro verifikaci telefonu (T011). Ostrý provider (např. Twilio)
 * přijde až po MVP — vrstva proto stojí na adaptéru `SmsProvider`, takže výměna
 * transportu je otázka jedné implementace. V dev/testu se kód jen zaloguje do
 * konzole a uloží do in-memory outboxu, ze kterého ho lze přečíst dev-only
 * endpointem `/api/dev/sms` (např. z e2e testu).
 */

export type OutboxSms = {
  to: string;
  body: string;
  /** Verifikační kód pro snadné čtení v dev/testu (v ostré SMS jen v `body`). */
  code?: string;
  sentAt: string;
};

/** Adaptér transportu SMS. Ostrá implementace se doplní po MVP (out of scope). */
export interface SmsProvider {
  send(message: { to: string; body: string; code?: string }): Promise<void>;
}

const isProduction = process.env.NODE_ENV === "production";

// In-memory outbox přežije jen v rámci procesu — pro dev server i Playwright
// (stejný proces) to stačí. Klíč na `globalThis` kvůli hot-reloadu.
const globalForSms = globalThis as unknown as { __smsOutbox?: OutboxSms[] };
const outbox: OutboxSms[] = (globalForSms.__smsOutbox ??= []);

/**
 * Dev transport: kód do konzole + outboxu. V produkci zatím jen strukturovaný
 * log (bez obsahu zprávy), dokud se nenapojí ostrý provider.
 */
const devProvider: SmsProvider = {
  async send({ to, body, code }) {
    if (isProduction) {
      // TODO(post-MVP): odeslat přes ostrý SMS provider.
      console.info(JSON.stringify({ type: "sms", to }));
      return;
    }
    outbox.push({ to, body, code, sentAt: new Date().toISOString() });
    console.info(`\n📱 [dev SMS] → ${to}\n   ${body}\n`);
  },
};

/** Aktivní provider. Zatím vždy dev; výběr ostrého transportu přijde po MVP. */
const provider: SmsProvider = devProvider;

/** Odešle SMS aktivním providerem. */
export function sendSms(message: {
  to: string;
  body: string;
  code?: string;
}): Promise<void> {
  return provider.send(message);
}

/** Dev/test-only: poslední SMS doručená na dané číslo. */
export function peekLastSms(to: string): OutboxSms | undefined {
  if (isProduction) return undefined;
  const normalized = to.trim();
  return [...outbox].reverse().find((s) => s.to === normalized);
}
