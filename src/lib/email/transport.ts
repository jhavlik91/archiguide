import "server-only";

import { Resend } from "resend";
import { pushOutboxEmail } from "./outbox";

/**
 * Jediné místo, které skutečně odesílá e-mail (TECHNICKE-ZADANI §2: Resend,
 * dev = konzolový/preview transport). Auth (T003) i notifikace (T033) volají
 * tuto funkci — doména si stará jen o obsah zprávy, ne o transport.
 *
 * Best-effort: nikdy nevyhodí. Volající (emit pipeline, auth flow) rozhodne,
 * jak s `{status: "failed"}` naloží — u notifikací se jen zaloguje do
 * `NotificationEmailDelivery`, primární akce se nikdy nezastaví.
 */

export type OutgoingEmail = {
  to: string;
  subject: string;
  /** Prostý text — vždy vyžadován (fallback pro klienty bez HTML i pro dev log). */
  text: string;
  /** HTML tělo. Bez něj se v produkci pošle jen text. */
  html?: string;
  /** Akční odkaz pro snadné čtení v dev outboxu (reset, verifikace, CTA). */
  link?: string;
};

export type SendEmailResult =
  | { status: "sent" }
  | { status: "failed"; error: string };

const isProduction = process.env.NODE_ENV === "production";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function sendEmail(
  message: OutgoingEmail,
): Promise<SendEmailResult> {
  if (!isProduction) {
    pushOutboxEmail({
      to: message.to,
      subject: message.subject,
      body: message.text,
      link: message.link,
    });
    console.info(
      `\n📧 [dev e-mail] → ${message.to}\n   ${message.subject}\n   ${message.link ?? message.text}\n`,
    );
    return { status: "sent" };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "ArchiGuide <notifikace@archiguide.cz>";

  if (!apiKey) {
    // Chybějící klíč v produkci: e-mail neodešleme, ale neshodíme volající akci.
    console.error(
      JSON.stringify({
        type: "email_error",
        to: message.to,
        error: "missing_resend_api_key",
      }),
    );
    return { status: "failed", error: "missing_resend_api_key" };
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: message.to,
      subject: message.subject,
      html: message.html ?? `<p>${escapeHtml(message.text)}</p>`,
      text: message.text,
    });
    if (error) {
      console.error(
        JSON.stringify({ type: "email_error", to: message.to, error: error.message }),
      );
      return { status: "failed", error: error.message };
    }
    console.info(
      JSON.stringify({ type: "email", to: message.to, subject: message.subject }),
    );
    return { status: "sent" };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      JSON.stringify({ type: "email_error", to: message.to, error: errorMessage }),
    );
    return { status: "failed", error: errorMessage };
  }
}
