import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { loginAndWait, registerViaUi, uniqueEmail } from "./auth-helpers";
import {
  deactivateUserByEmail,
  getUserIdByEmail,
  seedConversation,
  seedMessage,
} from "./db";

/**
 * E2E messagingu (T030). Konverzace se seeduje přímo do DB (UI vstupní bod pro
 * zahájení přijde s profilem/poptávkou); testujeme inbox, vlákno, odeslání,
 * nepřečtené, oprávnění a XSS přes reálné UI.
 *
 * Na desktopu je viditelný seznam i vlákno zároveň, proto se obsah zpráv ověřuje
 * uvnitř oblasti vlákna (region „Vlákno konverzace"), aby nekolidoval s náhledem
 * v seznamu.
 */

const PASSWORD = "test-password-123";

/** Lokální část e-mailu = fallback handle zobrazený v UI. */
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

test.describe("Messaging (T030)", () => {
  test("odeslání → nepřečtené u druhého → přečtení → odpověď; HTML jako text", async ({
    page,
  }) => {
    const emailA = uniqueEmail("msg-a");
    const emailB = uniqueEmail("msg-b");

    // Registrace B, poté A (A zůstane přihlášen).
    await registerViaUi(page, emailB, PASSWORD);
    await logout(page);
    await registerViaUi(page, emailA, PASSWORD);

    const aId = await getUserIdByEmail(emailA);
    const bId = await getUserIdByEmail(emailB);
    const convId = await seedConversation(aId, bId);

    // A otevře inbox a konverzaci s B.
    await page.goto("/messages");
    await expect(page.getByRole("heading", { name: "Zprávy" })).toBeVisible();
    await page.getByRole("link", { name: new RegExp(handle(emailB)) }).click();
    await page.waitForURL(`**/messages/${convId}`);

    // A odešle zprávu s HTML — musí se zobrazit jako text, ne jako tučné.
    const htmlContent = "Dobrý den <b>tučně</b>";
    await thread(page).getByLabel("Text zprávy").fill(htmlContent);
    await thread(page).getByRole("button", { name: "Odeslat zprávu" }).click();
    await expect(thread(page).getByText(htmlContent)).toBeVisible();
    expect(await thread(page).locator("b", { hasText: "tučně" }).count()).toBe(0);

    // Přepnutí na B → nepřečtené počítadlo v inboxu.
    await logout(page);
    await loginAndWait(page, emailB, PASSWORD);
    await page.goto("/messages");
    await expect(page.getByLabel("1 nepřečtených")).toBeVisible();

    // B otevře konverzaci, vidí zprávu od A a odpoví.
    await page.getByRole("link", { name: new RegExp(handle(emailA)) }).click();
    await page.waitForURL(`**/messages/${convId}`);
    await expect(thread(page).getByText(htmlContent)).toBeVisible();
    await thread(page).getByLabel("Text zprávy").fill("Zdravím zpět");
    await thread(page).getByRole("button", { name: "Odeslat zprávu" }).click();
    await expect(thread(page).getByText("Zdravím zpět")).toBeVisible();

    // A se vrátí a vidí odpověď.
    await logout(page);
    await loginAndWait(page, emailA, PASSWORD);
    await page.goto(`/messages/${convId}`);
    await expect(thread(page).getByText("Zdravím zpět")).toBeVisible();
  });

  test("cizí uživatel konverzaci neotevře (404)", async ({ page }) => {
    const emailA = uniqueEmail("msg-a2");
    const emailB = uniqueEmail("msg-b2");
    const emailC = uniqueEmail("msg-c2");

    await registerViaUi(page, emailA, PASSWORD);
    const aId = await getUserIdByEmail(emailA);
    await logout(page);
    await registerViaUi(page, emailB, PASSWORD);
    const bId = await getUserIdByEmail(emailB);

    const convId = await seedConversation(aId, bId);

    // C není účastník → 404 (nepotvrzujeme existenci cizí konverzace).
    await logout(page);
    await registerViaUi(page, emailC, PASSWORD);
    const res = await page.goto(`/messages/${convId}`);
    expect(res?.status()).toBe(404);
  });

  test("deaktivovaná protistrana → odeslání zablokované, historie čitelná", async ({
    page,
  }) => {
    const emailA = uniqueEmail("msg-a3");
    const emailB = uniqueEmail("msg-b3");

    await registerViaUi(page, emailB, PASSWORD);
    await logout(page);
    await registerViaUi(page, emailA, PASSWORD);

    const aId = await getUserIdByEmail(emailA);
    const bId = await getUserIdByEmail(emailB);
    const convId = await seedConversation(aId, bId);
    await seedMessage(convId, bId, "Historická zpráva");
    await deactivateUserByEmail(emailB);

    await page.goto(`/messages/${convId}`);
    // Historie zůstává čitelná (uvnitř vlákna).
    await expect(thread(page).getByText("Historická zpráva")).toBeVisible();
    // Composer je nahrazen vysvětlením, psát nelze.
    await expect(
      thread(page).getByText(/zrušený nebo deaktivovaný účet/i),
    ).toBeVisible();
    await expect(thread(page).getByLabel("Text zprávy")).toHaveCount(0);
  });
});
