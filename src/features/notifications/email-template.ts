import { NOTIFICATION_GROUP_LABELS, type NotificationGroup } from "./types";

/**
 * Čisté (bez DB / `next/*`) sestavení obsahu e-mailu (T033 § Main flow bod 2).
 * Odděleno od `email-dispatch.ts`, aby šlo plně pokrýt unit testy bez mockování
 * transportu/DB. Vždy nese hlavičku, důvod, CTA odkaz a patičku se správou
 * preferencí a one-click unsubscribe pro danou kategorii.
 */

export type NotificationEmailContent = {
  title: string;
  reason: string;
  ctaUrl: string;
  group: NotificationGroup;
  preferencesUrl: string;
  unsubscribeUrl: string;
};

export type RenderedEmail = {
  subject: string;
  text: string;
  html: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function renderNotificationEmail(
  content: NotificationEmailContent,
): RenderedEmail {
  const groupLabel = NOTIFICATION_GROUP_LABELS[content.group];

  const text = [
    content.title,
    "",
    content.reason,
    "",
    content.ctaUrl,
    "",
    "---",
    `Tento e-mail patří do kategorie „${groupLabel}“.`,
    `Spravovat notifikační preference: ${content.preferencesUrl}`,
    `Odhlásit e-maily z kategorie „${groupLabel}“: ${content.unsubscribeUrl}`,
  ].join("\n");

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <p style="font-size: 16px; font-weight: 600;">${escapeHtml(content.title)}</p>
      <p style="color: #555;">${escapeHtml(content.reason)}</p>
      <p>
        <a href="${content.ctaUrl}" style="display: inline-block; padding: 10px 16px; background: #111; color: #fff; text-decoration: none; border-radius: 6px;">
          Otevřít v ArchiGuide
        </a>
      </p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
      <p style="font-size: 12px; color: #999;">
        Tento e-mail patří do kategorie „${escapeHtml(groupLabel)}“.<br />
        <a href="${content.preferencesUrl}">Spravovat notifikační preference</a>
        &nbsp;·&nbsp;
        <a href="${content.unsubscribeUrl}">Odhlásit e-maily z této kategorie</a>
      </p>
    </div>
  `.trim();

  return { subject: content.title, text, html };
}

export type DigestStats = {
  newResponses: number;
  newRecommendations: number;
  unreadMessages: number;
};

/**
 * Týdenní/denní digest (T033 § Main flow bod 4): jen počty a titulky, NIKDY
 * obsah zpráv ani adresy. Volající zajistí, že se prázdný digest neodešle.
 */
export function renderDigestEmail(params: {
  stats: DigestStats;
  frequency: "daily" | "weekly";
  preferencesUrl: string;
  unsubscribeUrl: string;
  appUrl: string;
}): RenderedEmail {
  const { stats, frequency, preferencesUrl, unsubscribeUrl, appUrl } = params;
  const periodLabel = frequency === "weekly" ? "týdenní" : "denní";
  const subject =
    frequency === "weekly" ? "Váš týdenní souhrn — ArchiGuide" : "Váš denní souhrn — ArchiGuide";

  const lines: string[] = [];
  if (stats.newResponses > 0) lines.push(`${stats.newResponses}× nová reakce na poptávku`);
  if (stats.newRecommendations > 0) lines.push(`${stats.newRecommendations}× nové doporučení`);
  if (stats.unreadMessages > 0) lines.push(`${stats.unreadMessages}× nepřečtená zpráva`);

  const text = [
    `Váš ${periodLabel} souhrn z ArchiGuide:`,
    "",
    ...lines.map((line) => `- ${line}`),
    "",
    appUrl,
    "",
    "---",
    `Spravovat notifikační preference: ${preferencesUrl}`,
    `Odhlásit tento souhrn: ${unsubscribeUrl}`,
  ].join("\n");

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <p style="font-size: 16px; font-weight: 600;">Váš ${periodLabel} souhrn</p>
      <ul style="color: #333;">
        ${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
      </ul>
      <p>
        <a href="${appUrl}" style="display: inline-block; padding: 10px 16px; background: #111; color: #fff; text-decoration: none; border-radius: 6px;">
          Otevřít v ArchiGuide
        </a>
      </p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
      <p style="font-size: 12px; color: #999;">
        <a href="${preferencesUrl}">Spravovat notifikační preference</a>
        &nbsp;·&nbsp;
        <a href="${unsubscribeUrl}">Odhlásit tento souhrn</a>
      </p>
    </div>
  `.trim();

  return { subject, text, html };
}
