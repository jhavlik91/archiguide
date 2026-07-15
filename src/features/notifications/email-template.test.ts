import { describe, expect, it } from "vitest";
import { renderDigestEmail, renderNotificationEmail } from "./email-template";

describe("renderNotificationEmail", () => {
  const content = {
    title: "Nová reakce na poptávku",
    reason: "Profesionál reagoval na vaši poptávku Kuchyň.",
    ctaUrl: "https://app.archiguide.cz/requests/r1",
    group: "marketplace" as const,
    preferencesUrl: "https://app.archiguide.cz/settings#notifications",
    unsubscribeUrl: "https://app.archiguide.cz/api/notifications/unsubscribe?token=abc",
  };

  it("předmět je titulek notifikace", () => {
    expect(renderNotificationEmail(content).subject).toBe(content.title);
  });

  it("text i html obsahují CTA odkaz a patičku s preferencemi a unsubscribe", () => {
    const { text, html } = renderNotificationEmail(content);
    for (const body of [text, html]) {
      expect(body).toContain(content.ctaUrl);
      expect(body).toContain(content.preferencesUrl);
      expect(body).toContain(content.unsubscribeUrl);
    }
  });

  it("html escapuje titulek/důvod (bez XSS injekce)", () => {
    const { html } = renderNotificationEmail({
      ...content,
      title: "<script>alert(1)</script>",
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("nikdy neobsahuje jiná kategorie, než která byla předána", () => {
    const { text } = renderNotificationEmail({ ...content, group: "verification" });
    expect(text).toContain("Verifikace účtu");
    expect(text).not.toContain("Poptávky a reakce");
  });
});

describe("renderDigestEmail", () => {
  const base = {
    stats: { newResponses: 3, newRecommendations: 1, unreadMessages: 0 },
    preferencesUrl: "https://app.archiguide.cz/settings#notifications",
    unsubscribeUrl: "https://app.archiguide.cz/api/notifications/unsubscribe?token=abc",
    appUrl: "https://app.archiguide.cz",
  };

  it("obsahuje jen počty a titulky, žádný obsah zpráv ani adresy", () => {
    const { text, html } = renderDigestEmail({ ...base, frequency: "weekly" });
    expect(text).toContain("3× nová reakce na poptávku");
    expect(text).toContain("1× nové doporučení");
    expect(text).not.toMatch(/@/); // žádná e-mailová adresa v těle
    expect(html).toContain("3× nová reakce na poptávku");
  });

  it("nulový počet dané kategorie se v souhrnu nevypisuje", () => {
    const { text } = renderDigestEmail({ ...base, frequency: "daily" });
    expect(text).not.toContain("nepřečtená zpráva");
  });

  it("denní vs. týdenní má odlišný předmět", () => {
    const daily = renderDigestEmail({ ...base, frequency: "daily" });
    const weekly = renderDigestEmail({ ...base, frequency: "weekly" });
    expect(daily.subject).not.toBe(weekly.subject);
  });
});
