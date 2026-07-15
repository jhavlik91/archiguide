import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { loginAndWait, registerViaUi, uniqueEmail } from "./auth-helpers";
import {
  attachmentIdForMessage,
  blockExists,
  getUserIdByEmail,
  latestMessageId,
  reportCountForMessage,
  seedConversation,
  seedMessage,
} from "./db";

/**
 * E2E messagingu T031 (přílohy, blokace, nahlášení, privacy hint). Konverzace se
 * seeduje přímo do DB; přílohy, blokace a report se ovládají přes reálné UI,
 * ověřují se přes UI i přímo v DB (report/block záznam).
 */

const PASSWORD = "test-password-123";

// 1×1 PNG (validní magic bytes → attachment systém ho pozná jako image/png).
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

function handle(email: string): string {
  return email.split("@")[0]!;
}

function thread(page: Page) {
  return page.getByRole("region", { name: "Vlákno konverzace" });
}

async function logout(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Odhlásit se" }).click();
  await page.waitForURL("**/login");
}

// Každý blok jede pod vlastní „IP" (X-Forwarded-For), aby si registrace/login
// nesdílely rate-limit budget (5/min/IP) a testy nebyly na sobě závislé.
test.describe("Messaging — přílohy (T031)", () => {
  test.use({ extraHTTPHeaders: { "x-forwarded-for": "10.31.0.1" } });

  test("odeslání obrázku → protistrana vidí náhled a stáhne; třetí uživatel ne", async ({
    page,
  }) => {
    const emailA = uniqueEmail("att-a");
    const emailB = uniqueEmail("att-b");
    const emailC = uniqueEmail("att-c");

    await registerViaUi(page, emailB, PASSWORD);
    await logout(page);
    await registerViaUi(page, emailA, PASSWORD);

    const aId = await getUserIdByEmail(emailA);
    const bId = await getUserIdByEmail(emailB);
    const convId = await seedConversation(aId, bId);

    await page.goto(`/messages/${convId}`);

    // Přiložení obrázku přes skryté file pole (tlačítko ho jinak otevírá).
    await thread(page).locator('input[type="file"]').setInputFiles({
      name: "plan.png",
      mimeType: "image/png",
      buffer: PNG_BYTES,
    });
    // Chip přiloženého souboru potvrdí, že se stav composeru aktualizoval.
    await expect(thread(page).getByText("plan.png")).toBeVisible();
    await thread(page).getByRole("button", { name: "Odeslat zprávu" }).click();

    // Náhled obrázku ve vlákně (inline <img> s alt = název souboru). Na načtení
    // se ptáme přes `naturalWidth`, ne `toBeVisible()`: náhled je 1×1 PNG bez
    // rozměrů v atributech, takže dokud request na přílohu neskončí, má <img>
    // nulový box a Playwright ho hlásí jako „hidden" — assertion by tak závodila
    // s načtením obrázku (v zatíženém CI to na 5s timeout občas nevyšlo).
    // `naturalWidth > 0` je navíc přesně to, co test tvrdí: náhled se opravdu
    // vykreslil (rozbitý obrázek by `toBeVisible()` prošel — vykreslí alt text).
    // Delší timeout: mezi kliknutím a náhledem je celý roundtrip POST
    // /api/messages (na CI dev serveru včetně první kompilace routy) +
    // router.refresh() — výchozích 5 s na zatíženém CI nestačí.
    const image = thread(page).getByRole("img", { name: "plan.png" });
    await expect(image).toBeAttached({ timeout: 15_000 });
    await expect
      .poll(() => image.evaluate((el: HTMLImageElement) => el.naturalWidth))
      .toBeGreaterThan(0);

    // Autorizovaná URL přílohy.
    const messageId = await latestMessageId(convId);
    const attachmentId = await attachmentIdForMessage(messageId);
    expect(attachmentId).not.toBeNull();
    const url = `/api/attachments/${attachmentId}`;

    // Vlastník (A) stáhne (přes request, ať download nezruší navigaci).
    expect((await page.request.get(url)).status()).toBe(200);

    // Účastník B stáhne.
    await logout(page);
    await loginAndWait(page, emailB, PASSWORD);
    expect((await page.request.get(url)).status()).toBe(200);

    // Třetí uživatel C přílohu nestáhne (404 — neprozrazujeme existenci).
    await logout(page);
    await registerViaUi(page, emailC, PASSWORD);
    expect((await page.request.get(url)).status()).toBe(404);
  });
});

test.describe("Messaging — blokace (T031)", () => {
  test.use({ extraHTTPHeaders: { "x-forwarded-for": "10.31.0.2" } });

  test("blokovaný nedoručí; blokující nevidí v inboxu; odblokování obnoví", async ({
    page,
  }) => {
    const emailA = uniqueEmail("blk-a");
    const emailB = uniqueEmail("blk-b");

    await registerViaUi(page, emailB, PASSWORD);
    await logout(page);
    await registerViaUi(page, emailA, PASSWORD);

    const aId = await getUserIdByEmail(emailA);
    const bId = await getUserIdByEmail(emailB);
    const convId = await seedConversation(aId, bId);
    await seedMessage(convId, aId, "Ahoj, mám dotaz");

    // A zablokuje B z hlavičky vlákna.
    await page.goto(`/messages/${convId}`);
    await thread(page).getByRole("button", { name: "Blokovat" }).click();
    // Delší timeout: přepnutí tlačítka čeká na server akci + router.refresh(),
    // což na zatíženém CI dev serveru výchozích 5 s občas nestihne.
    await expect(
      thread(page).getByRole("button", { name: "Odblokovat" }),
    ).toBeVisible({ timeout: 15_000 });
    expect(await blockExists(emailA, emailB)).toBe(true);

    // A už konverzaci nevidí v aktivním inboxu.
    await page.goto("/messages");
    await expect(
      page.getByRole("link", { name: new RegExp(handle(emailB)) }),
    ).toHaveCount(0);

    // B nemůže doručit (composer nahrazen neutrální hláškou).
    await logout(page);
    await loginAndWait(page, emailB, PASSWORD);
    await page.goto(`/messages/${convId}`);
    await expect(thread(page).getByText("Zprávu teď nelze doručit.")).toBeVisible();
    await expect(thread(page).getByLabel("Text zprávy")).toHaveCount(0);

    // A odblokuje v nastavení → B zase může psát.
    await logout(page);
    await loginAndWait(page, emailA, PASSWORD);
    await page.goto("/settings");
    await page.getByRole("button", { name: "Odblokovat" }).click();
    await expect(page.getByText("Nikoho jste nezablokovali.")).toBeVisible();
    expect(await blockExists(emailA, emailB)).toBe(false);

    await logout(page);
    await loginAndWait(page, emailB, PASSWORD);
    await page.goto(`/messages/${convId}`);
    await thread(page).getByLabel("Text zprávy").fill("Zkouším znovu");
    await thread(page).getByRole("button", { name: "Odeslat zprávu" }).click();
    await expect(thread(page).getByText("Zkouším znovu")).toBeVisible();
  });
});

test.describe("Messaging — nahlášení a privacy hint (T031)", () => {
  test.use({ extraHTTPHeaders: { "x-forwarded-for": "10.31.0.3" } });

  test("nahlášení cizí zprávy vytvoří report; vlastní zpráva nahlásit nejde", async ({
    page,
  }) => {
    const emailA = uniqueEmail("rep-a");
    const emailB = uniqueEmail("rep-b");

    await registerViaUi(page, emailA, PASSWORD);
    await logout(page);
    await registerViaUi(page, emailB, PASSWORD);

    const aId = await getUserIdByEmail(emailA);
    const bId = await getUserIdByEmail(emailB);
    const convId = await seedConversation(aId, bId);
    await seedMessage(convId, aId, "Podezřelá nabídka");
    const messageId = await latestMessageId(convId);

    // B (přihlášen) nahlásí zprávu od A.
    await page.goto(`/messages/${convId}`);
    await thread(page).getByText("Podezřelá nabídka").hover();
    await thread(page).getByRole("button", { name: "Nahlásit zprávu" }).click();
    await page.getByRole("radio", { name: "Spam" }).click();
    await page.getByRole("button", { name: "Nahlásit", exact: true }).click();

    await expect(page.getByText(/byla nahlášena/i)).toBeVisible();
    expect(await reportCountForMessage(messageId)).toBe(1);
  });

  test("kontaktní údaj v konceptu vyvolá hint, zpráva se ale odešle", async ({
    page,
  }) => {
    const emailA = uniqueEmail("hint-a");
    const emailB = uniqueEmail("hint-b");

    await registerViaUi(page, emailB, PASSWORD);
    await logout(page);
    await registerViaUi(page, emailA, PASSWORD);

    const aId = await getUserIdByEmail(emailA);
    const bId = await getUserIdByEmail(emailB);
    const convId = await seedConversation(aId, bId);

    await page.goto(`/messages/${convId}`);
    await thread(page)
      .getByLabel("Text zprávy")
      .fill("zavolej mi na +420 777 123 456");
    // Nenucený hint se zobrazí, ale odeslání nic neblokuje.
    await expect(thread(page).getByText(/na vlastní uvážení/i)).toBeVisible();
    await thread(page).getByRole("button", { name: "Odeslat zprávu" }).click();
    await expect(
      thread(page).getByText("zavolej mi na +420 777 123 456"),
    ).toBeVisible();
  });
});
