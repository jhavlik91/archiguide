import "server-only";

/**
 * Sdílený in-memory outbox pro dev/test doručování (T003, generalizováno v T033).
 * Přežije jen v rámci procesu — pro dev server i Playwright (stejný proces) to
 * stačí. Klíč na `globalThis` kvůli hot-reloadu, aby se odchozí e-maily
 * neztrácely mezi rebuildy modulu.
 */

export type OutboxEmail = {
  to: string;
  subject: string;
  body: string;
  /** Případný akční odkaz (verifikace, reset, CTA notifikace) pro čtení v testu. */
  link?: string;
  sentAt: string;
};

const globalForOutbox = globalThis as unknown as {
  __emailOutbox?: OutboxEmail[];
};
const outbox: OutboxEmail[] = (globalForOutbox.__emailOutbox ??= []);

export function pushOutboxEmail(
  message: Omit<OutboxEmail, "sentAt">,
): OutboxEmail {
  const email: OutboxEmail = { ...message, sentAt: new Date().toISOString() };
  outbox.push(email);
  return email;
}

/** Dev/test-only: poslední e-mail doručený na danou adresu. */
export function peekLastEmail(to: string): OutboxEmail | undefined {
  const normalized = to.trim().toLowerCase();
  return [...outbox].reverse().find((e) => e.to.toLowerCase() === normalized);
}
