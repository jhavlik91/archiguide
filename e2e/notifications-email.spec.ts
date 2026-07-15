import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  fetchEmailLink,
  registerViaUi,
  uniqueEmail,
  waitForEmail,
} from "./auth-helpers";
import { getUserIdByEmail, seedConversation } from "./db";

/**
 * E2E notifikačního e-mailu, preferencí a unsubscribe (T033). Messaging
 * (`new_message`) má e-mail v katalogu jen jako opt-in — test proto nejdřív
 * zapne e-mail pro skupinu Zprávy v preferenčním UI (ověřuje, že se preference
 * okamžitě projeví), pak přes reálné UI vyvolá zprávu, ověří doručený e-mail
 * (CTA odkaz + unsubscribe patička) a nakonec unsubscribe odkazem bez
 * přihlášení kanál zase vypne.
 */

const PASSWORD = "test-password-123";

async function logout(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Odhlásit se" }).click();
  await page.waitForURL("**/login");
}

test.describe("Notifikace — e-mail, preference, unsubscribe (T033)", () => {
  test("preference zapne e-mail pro skupinu → zpráva pošle e-mail → unsubscribe kanál zase vypne", async ({
    page,
  }) => {
    // Test prochází dva registrace/login cykly + čekání na dev outbox; s
    // dosud nezkompilovanými routami (`/unsubscribe`, preferenční UI) v dev
    // módu je výchozích 30 s těsných.
    test.setTimeout(90_000);
    const emailA = uniqueEmail("t033-a");
    const emailB = uniqueEmail("t033-b");

    // B se zaregistruje a ověří e-mail — dispatch posílá jen na ověřenou adresu.
    await registerViaUi(page, emailB, PASSWORD);
    const verifyLink = await fetchEmailLink(page, emailB);
    await page.goto(verifyLink);
    await page.waitForURL(/\/settings\?emailVerified=1/);

    // Zapne e-mail pro skupinu Zprávy (default politika messagingu e-mail
    // neposílá — jen in-app). Ostatní pole zůstávají na výchozí hodnotě.
    await page.getByRole("checkbox", { name: "Zprávy — e-mail" }).check();
    await page.getByRole("button", { name: "Uložit preference" }).click();
    await expect(page.getByText("Preference uloženy.")).toBeVisible();
    // Přetrvá i po reloadu (uloženo na účtu, ne jen v UI stavu).
    await page.reload();
    await expect(
      page.getByRole("checkbox", { name: "Zprávy — e-mail" }),
    ).toBeChecked();

    await logout(page);

    // A se zaregistruje a pošle B zprávu přes reálné UI.
    await registerViaUi(page, emailA, PASSWORD);
    const aId = await getUserIdByEmail(emailA);
    const bId = await getUserIdByEmail(emailB);
    const convId = await seedConversation(aId, bId);

    await page.goto(`/messages/${convId}`);
    await page.getByLabel("Text zprávy").fill("Ahoj, mám dotaz");
    await page.getByRole("button", { name: "Odeslat zprávu" }).click();
    await expect(
      page.getByText("Ahoj, mám dotaz", { exact: true }),
    ).toBeVisible();

    // B dostane e-mail: CTA vede do konverzace, patička nese preference i unsubscribe.
    const email = await waitForEmail(
      page,
      emailB,
      (candidate) => candidate.subject === "Nová zpráva",
    );
    expect(email.link).toContain(`/messages/${convId}`);
    expect(email.body).toContain("Spravovat notifikační preference");

    const unsubscribeMatch = email.body.match(/https?:\/\/\S*\/unsubscribe\?token=\S+/);
    expect(unsubscribeMatch, "e-mail obsahuje unsubscribe odkaz").toBeTruthy();
    const unsubscribeUrl = unsubscribeMatch![0];

    // Unsubscribe funguje bez přihlášení a jen pro danou kategorii.
    await page.context().clearCookies();
    await page.goto(unsubscribeUrl);
    await page.waitForURL(/\/settings\?unsubscribed=messaging/);
    await expect(
      page.getByText("E-maily z kategorie „Zprávy“ byly vypnuty."),
    ).toBeVisible();

    // Bez session je to veřejná stránka přesměrovaná na login pro plný náhled
    // nastavení — přihlásíme se jako B a ověříme, že checkbox reálně sedí.
    await page.goto("/settings");
    if (page.url().includes("/login")) {
      await page.getByLabel("E-mail").fill(emailB);
      await page.getByLabel("Heslo").fill(PASSWORD);
      await page.getByRole("button", { name: "Přihlásit se" }).click();
      await page.waitForURL(/\/settings/);
    }
    await expect(
      page.getByRole("checkbox", { name: "Zprávy — e-mail" }),
    ).not.toBeChecked();
  });
});
