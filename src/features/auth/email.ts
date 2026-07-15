import "server-only";

import { sendEmail } from "@/lib/email/transport";
import { peekLastEmail as peekLastOutboxEmail, type OutboxEmail } from "@/lib/email/outbox";

/**
 * Odesílání transakčních e-mailů pro auth flow. Transport (Resend v produkci,
 * dev outbox jinak) řeší sdílené `@/lib/email/transport` (T033); tady zůstává
 * jen obsah jednotlivých zpráv.
 */

async function deliver(message: {
  to: string;
  subject: string;
  body: string;
  link?: string;
}): Promise<void> {
  await sendEmail({
    to: message.to,
    subject: message.subject,
    text: message.link ? `${message.body}\n\n${message.link}` : message.body,
    link: message.link,
  });
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
  if (process.env.NODE_ENV === "production") return undefined;
  return peekLastOutboxEmail(to);
}
