import "server-only";

/**
 * Odesílání transakčních e-mailů pro auth flow. V produkci se napojí Resend
 * (viz TECHNICKE-ZADANI §2); v dev/testu se e-mail jen zaloguje a uloží do
 * in-memory outboxu, ze kterého ho lze přečíst přes dev-only endpoint
 * `/api/dev/outbox` (např. z e2e testu reset flow).
 */

export type OutboxEmail = {
  to: string;
  subject: string;
  body: string;
  /** Případný akční odkaz (verifikace, reset) pro snadné čtení v dev/testu. */
  link?: string;
  sentAt: string;
};

const isProduction = process.env.NODE_ENV === "production";

// Sdílený in-memory outbox přežije jen v rámci procesu — což pro dev server
// i Playwright (stejný proces) stačí. Klíč na `globalThis` kvůli hot-reloadu.
const globalForOutbox = globalThis as unknown as {
  __authOutbox?: OutboxEmail[];
};
const outbox: OutboxEmail[] = (globalForOutbox.__authOutbox ??= []);

async function deliver(message: Omit<OutboxEmail, "sentAt">): Promise<void> {
  const email: OutboxEmail = { ...message, sentAt: new Date().toISOString() };

  if (isProduction) {
    // TODO(T033): odeslat přes Resend. Zatím jen log, aby se nic neztratilo.
    console.info(
      JSON.stringify({ type: "email", to: email.to, subject: email.subject }),
    );
    return;
  }

  outbox.push(email);
  console.info(
    `\n📧 [dev e-mail] → ${email.to}\n   ${email.subject}\n   ${email.link ?? email.body}\n`,
  );
}

/** Verifikační e-mail po registraci. Zatím stub (napojení v T011/T033). */
export function sendVerificationEmail(
  to: string,
  verifyUrl: string,
): Promise<void> {
  return deliver({
    to,
    subject: "Ověřte svůj e-mail — ArchiGuide",
    body: "Vítejte v ArchiGuide. Potvrďte prosím svůj e-mail.",
    link: verifyUrl,
  });
}

/** E-mail s odkazem pro reset hesla. */
export function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
): Promise<void> {
  return deliver({
    to,
    subject: "Obnovení hesla — ArchiGuide",
    body: "Klikněte na odkaz pro nastavení nového hesla. Platnost 1 hodina.",
    link: resetUrl,
  });
}

/** Pozvánka do firmy (T009). Odkaz vede na stránku přijetí/odmítnutí. */
export function sendOrgInvitationEmail(
  to: string,
  inviteUrl: string,
  orgName: string,
): Promise<void> {
  return deliver({
    to,
    subject: `Pozvánka do firmy ${orgName} — ArchiGuide`,
    body: `Byli jste pozváni do firmy ${orgName}. Přijměte pozvánku odkazem. Platnost 14 dní.`,
    link: inviteUrl,
  });
}

/** Dev/test-only: poslední e-mail doručený na danou adresu. */
export function peekLastEmail(to: string): OutboxEmail | undefined {
  if (isProduction) return undefined;
  const normalized = to.trim().toLowerCase();
  return [...outbox].reverse().find((e) => e.to.toLowerCase() === normalized);
}
