import { expect, test } from "@playwright/test";
import {
  ADMIN_STATE,
  STORAGE_STATE,
  registerViaUi,
  uniqueEmail,
} from "./auth-helpers";
import {
  db,
  getMessageModerationState,
  getUserIdByEmail,
  listNotificationsFor,
  seedConversation,
  seedMessage,
  seedReport,
} from "./db";

/**
 * E2E moderace (T036). Nahlašovací tlačítko přidávají až konzumující domény
 * (T031 pro zprávy) — stejně jako u messagingu (T030) proto samotné nahlášení
 * seedujeme přímo do DB a testujeme frontu, detail (omezený kontext), moderační
 * akci a její dopad (placeholder u zprávy, notifikace) přes reálné admin UI.
 */

const PASSWORD = "test-password-123";

async function lastMessageId(conversationId: string): Promise<string> {
  const row = await db.message.findFirstOrThrow({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
  });
  return row.id;
}

test.describe("Moderace (T036)", () => {
  test.use({ storageState: ADMIN_STATE });

  test("nahlášená zpráva → fronta → omezený kontext → hide → placeholder, reporter notifikován", async ({
    page,
    browser,
  }) => {
    const emailSender = uniqueEmail("mod-sender");
    const emailReporter = uniqueEmail("mod-reporter");

    // Založíme účty a konverzaci mimo admin session (jiný browser context).
    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await registerViaUi(otherPage, emailSender, PASSWORD);
    const senderId = await getUserIdByEmail(emailSender);
    await otherPage.getByRole("button", { name: "Odhlásit se" }).click();
    await otherPage.waitForURL("**/login");
    await registerViaUi(otherPage, emailReporter, PASSWORD);
    const reporterId = await getUserIdByEmail(emailReporter);

    const convId = await seedConversation(senderId, reporterId);
    // Dost zpráv OKOLO nahlášené, aby šlo ověřit, že moderátor nevidí celou
    // konverzaci — jen bezprostřední okolí.
    await seedMessage(convId, senderId, "Zpráva 1 — daleko před");
    await seedMessage(convId, senderId, "Zpráva 2 — daleko před");
    await seedMessage(convId, senderId, "Zpráva 3 — soused před");
    await seedMessage(convId, senderId, "NAHLÁŠENÁ zpráva s obtěžováním");
    const targetId = await lastMessageId(convId);
    await seedMessage(convId, reporterId, "Zpráva 5 — soused po");
    await seedMessage(convId, senderId, "Zpráva 6 — daleko po");
    await seedMessage(convId, senderId, "Zpráva 7 — daleko po");

    const reportId = await seedReport({
      targetType: "message",
      targetId,
      reporterUserId: reporterId,
      reason: "harassment",
    });

    // Moderátor (admin) vidí případ ve frontě.
    await page.goto("/admin/reports");
    await expect(
      page.getByRole("heading", { name: "Nahlášení" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Obtěžování/ })).toBeVisible();

    // Detail: nahlášená zpráva + bezprostřední okolí, NE celá konverzace.
    await page.goto(`/admin/reports/${reportId}`);
    await expect(
      page.getByText("NAHLÁŠENÁ zpráva s obtěžováním"),
    ).toBeVisible();
    await expect(page.getByText("Zpráva 3 — soused před")).toBeVisible();
    await expect(page.getByText("Zpráva 5 — soused po")).toBeVisible();
    await expect(page.getByText("Zpráva 1 — daleko před")).not.toBeVisible();
    await expect(page.getByText("Zpráva 7 — daleko po")).not.toBeVisible();

    // Moderátor obsah skryje s povinným důvodem.
    await page.getByLabel("Typ akce").click();
    await page.getByRole("option", { name: "Skrýt obsah" }).click();
    await page
      .getByLabel(/Důvod \(povinný/)
      .fill("Obtěžující obsah vůči druhé straně konverzace.");
    await page.getByRole("button", { name: "Provést akci" }).click();
    await expect(page.getByText("Cíl je aktuálně skrytý.")).toBeVisible();

    // Zpráva je v DB skrytá.
    await expect.poll(() => getMessageModerationState(targetId)).toBe("hidden");

    // Odesílatel (nahlášený) vidí ve vlákně placeholder místo obsahu.
    await otherPage.goto(`/messages/${convId}`);
    await expect(
      otherPage.getByText("Zpráva byla skryta moderátorem."),
    ).toBeVisible();
    await expect(
      otherPage.getByText("NAHLÁŠENÁ zpráva s obtěžováním"),
    ).toHaveCount(0);

    // Reporter dostal obecnou zpětnou vazbu (bez detailu akce).
    await expect
      .poll(async () => (await listNotificationsFor(reporterId)).length)
      .toBeGreaterThan(0);
    const reporterNotifs = await listNotificationsFor(reporterId);
    expect(
      reporterNotifs.some((n) => n.title.includes("nahlášení bylo vyřešeno")),
    ).toBe(true);

    // Nahlášený (odesílatel) byl informován o zásahu s důvodem.
    const senderNotifs = await listNotificationsFor(senderId);
    expect(senderNotifs.length).toBeGreaterThan(0);

    await other.close();
  });

  test("bez role moderátor/admin → fronta vrátí 403", async ({ browser }) => {
    const context = await browser.newContext({ storageState: STORAGE_STATE });
    const page = await context.newPage();
    const response = await page.goto("/admin/reports");
    expect(response?.status()).toBe(403);
    await context.close();
  });
});
