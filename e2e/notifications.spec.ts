import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { loginAndWait, registerViaUi, uniqueEmail } from "./auth-helpers";
import {
  getNotificationIdFor,
  getUserIdByEmail,
  listNotificationsFor,
  seedConversation,
} from "./db";

/**
 * E2E notifikací (T032). Notifikace vznikají jako vedlejší efekt messagingu
 * (T030) — testujeme přes reálné UI: odeslání zprávy → nepřečtená notifikace u
 * příjemce → klik z centra vede do konverzace a označí přečteno; vlastní akce
 * nenotifikuje; rychlá série zpráv se dedupem sloučí do jedné notifikace s počtem.
 */

const PASSWORD = "test-password-123";

function bell(page: Page) {
  // Zvoneček (tlačítko) — na rozdíl od navigační položky „Notifikace" (odkaz).
  return page.getByRole("button", { name: /^Notifikace/ });
}

function thread(page: Page) {
  return page.getByRole("region", { name: "Vlákno konverzace" });
}

async function logout(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Odhlásit se" }).click();
  await page.waitForURL("**/login");
}

async function sendMessage(page: Page, text: string): Promise<void> {
  await thread(page).getByLabel("Text zprávy").fill(text);
  await thread(page).getByRole("button", { name: "Odeslat zprávu" }).click();
  await expect(thread(page).getByText(text, { exact: true })).toBeVisible();
}

test.describe("Notifikace (T032)", () => {
  test("nová zpráva → nepřečtená notifikace → klik do konverzace → přečteno; dedup; vlastní akce nenotifikuje", async ({
    page,
  }) => {
    const emailA = uniqueEmail("notif-a");
    const emailB = uniqueEmail("notif-b");

    await registerViaUi(page, emailB, PASSWORD);
    await logout(page);
    await registerViaUi(page, emailA, PASSWORD);

    const aId = await getUserIdByEmail(emailA);
    const bId = await getUserIdByEmail(emailB);
    const convId = await seedConversation(aId, bId);

    // A pošle tři zprávy rychle za sebou.
    await page.goto(`/messages/${convId}`);
    await sendMessage(page, "Ahoj, mám dotaz");
    await sendMessage(page, "Ještě jedna věc");
    await sendMessage(page, "A poslední");

    // Dedup: B má právě JEDNU nepřečtenou notifikaci s počtem 3. Composer
    // renderuje zprávu optimisticky (před potvrzením serverem = před emitem),
    // proto na doběhnutí emitů počkáme pollingem DB.
    await expect
      .poll(async () => {
        const rows = await listNotificationsFor(bId);
        return rows.length === 1 ? rows[0]!.count : rows.length;
      })
      .toBe(3);
    const bNotifs = await listNotificationsFor(bId);
    expect(bNotifs[0]!.state).toBe("unread");

    // Vlastní akce nenotifikuje: A nemá žádnou notifikaci a zvoneček je bez počtu.
    expect(await listNotificationsFor(aId)).toHaveLength(0);
    await expect(
      page.getByRole("button", { name: "Notifikace", exact: true }),
    ).toBeVisible();

    // B se přihlásí → zvoneček ukazuje 1 nepřečtenou.
    await logout(page);
    await loginAndWait(page, emailB, PASSWORD);
    await expect(bell(page)).toHaveAttribute(
      "aria-label",
      "Notifikace: 1 nových",
    );

    // Rozbalí centrum a klikne na notifikaci → vede do konverzace.
    await bell(page).click();
    const menu = page.getByRole("menu", { name: "Notifikace" });
    await expect(menu.getByText("Nová zpráva")).toBeVisible();
    await menu.getByRole("link", { name: /Nová zpráva/ }).click();
    await page.waitForURL(`**/messages/${convId}`);
    await expect(thread(page).getByText("A poslední")).toBeVisible();

    // Notifikace je označena přečtená → zvoneček bez počtu.
    await expect(
      page.getByRole("button", { name: "Notifikace", exact: true }),
    ).toBeVisible();
    await expect
      .poll(async () => (await listNotificationsFor(bId))[0]!.state)
      .toBe("read");
  });

  test("cizí notifikace nejsou dostupné (centrum vidí jen své)", async ({
    page,
  }) => {
    const emailA = uniqueEmail("notif-a2");
    const emailB = uniqueEmail("notif-b2");
    const emailC = uniqueEmail("notif-c2");

    await registerViaUi(page, emailB, PASSWORD);
    await logout(page);
    await registerViaUi(page, emailA, PASSWORD);

    const aId = await getUserIdByEmail(emailA);
    const bId = await getUserIdByEmail(emailB);
    const convId = await seedConversation(aId, bId);

    await page.goto(`/messages/${convId}`);
    await sendMessage(page, "Zpráva pro B");

    // Vznikla notifikace pro B — zjistíme její ID přímo z DB pro test přístupu.
    await expect
      .poll(async () => (await listNotificationsFor(bId)).length)
      .toBe(1);
    const bNotifId = (await getNotificationIdFor(bId))!;

    // C je nezúčastněný uživatel → žádné notifikace, prázdné centrum.
    await logout(page);
    await registerViaUi(page, emailC, PASSWORD);
    await page.goto("/notifications");
    await expect(
      page.getByRole("heading", { name: "Notifikace", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Žádné notifikace")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Notifikace", exact: true }),
    ).toBeVisible();

    // C nesmí otevřít cizí notifikaci přes go-route → 404 (nepotvrzujeme existenci).
    const res = await page.goto(`/notifications/${bNotifId}`);
    expect(res?.status()).toBe(404);
  });
});
