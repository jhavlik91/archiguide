import { expect, test } from "@playwright/test";
import {
  ADMIN_STATE,
  STORAGE_STATE,
  loginViaUi,
  registerViaUi,
  uniqueEmail,
} from "./auth-helpers";
import { db, getUserIdByEmail, grantRoleByEmail } from "./db";

test.afterAll(async () => {
  await db.$disconnect();
});

/**
 * Admin — správa uživatelů (T035). Blokace/odblokování s povinným důvodem +
 * audit záznam, a moderátor jako read-only role bez přístupu k akcím ani
 * k taxonomii (jen admin).
 */

test.describe("Admin blokuje a odblokuje uživatele", () => {
  test.use({ storageState: ADMIN_STATE });

  test("blokace vyžaduje důvod, znemožní přihlášení a založí audit záznam; odblokování ho vrátí", async ({
    page,
    browser,
  }) => {
    const email = uniqueEmail("suspend-target");
    const password = "test-password-123";

    // Cíl si založí vlastní (neautentizovaný) kontext, aby nekolidoval se
    // sdílenou admin session téhle stránky.
    const targetContext = await browser.newContext();
    const targetPage = await targetContext.newPage();
    await registerViaUi(targetPage, email, password);
    await targetContext.close();

    await page.goto(`/admin/users?query=${encodeURIComponent(email)}`);
    await page.getByRole("link", { name: new RegExp(email) }).click();
    await page.waitForURL(/\/admin\/users\/.+/);

    // Potvrzovací tlačítko je bez vyplněného důvodu blokováno klientskou
    // validací — zkusíme prázdné, pak s důvodem.
    await page.getByRole("button", { name: "Blokovat" }).click();
    await page.getByRole("button", { name: "Potvrdit" }).click();
    await expect(page.getByText("alespoň 3 znaky")).toBeVisible();

    await page.getByLabel("Důvod").fill("Opakované porušení podmínek.");
    await page.getByRole("button", { name: "Potvrdit" }).click();
    await expect(page.getByText("Blokovaný")).toBeVisible();
    await expect(
      page.getByText("Zablokován").first(),
    ).toBeVisible();
    await expect(page.getByText("Opakované porušení podmínek.")).toBeVisible();

    // Suspendovaný uživatel se nepřihlásí (T035 AC).
    const blockedContext = await browser.newContext();
    const blockedPage = await blockedContext.newPage();
    await loginViaUi(blockedPage, email, password);
    await expect(
      blockedPage.getByText("Účet je zablokovaný administrátorem."),
    ).toBeVisible();
    await expect(blockedPage).toHaveURL(/\/login/);
    await blockedContext.close();

    // Odblokování vrátí přihlášení.
    await page.getByRole("button", { name: "Odblokovat" }).click();
    await page.getByLabel("Důvod").fill("Prošetřeno, v pořádku.");
    await page.getByRole("button", { name: "Potvrdit" }).click();
    await expect(page.getByText("Aktivní").first()).toBeVisible();

    const reactivatedContext = await browser.newContext();
    const reactivatedPage = await reactivatedContext.newPage();
    await loginViaUi(reactivatedPage, email, password);
    await reactivatedPage.waitForURL("**/dashboard");
    await reactivatedContext.close();
  });

  test("admin nemůže zablokovat sám sebe", async ({ page }) => {
    const adminId = await getUserIdByEmail("admin@archiguide.test");
    await page.goto(`/admin/users/${adminId}`);
    await expect(
      page.getByText("admin akce nad sebou samým nejsou dostupné"),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Blokovat" })).toHaveCount(
      0,
    );
  });
});

test.describe("Moderátor — read-only výpis uživatelů", () => {
  test("vidí výpis, ale ne akce; taxonomie je mimo dosah", async ({
    page,
  }) => {
    const email = uniqueEmail("moderator");
    const password = "test-password-123";
    await registerViaUi(page, email, password);
    await grantRoleByEmail(email, "moderator");

    // Role se čte per-request (T004) — není třeba se znovu přihlašovat.
    const listResponse = await page.goto("/admin/users");
    expect(listResponse?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { name: "Uživatelé" }),
    ).toBeVisible();

    const adminId = await getUserIdByEmail("admin@archiguide.test");
    await page.goto(`/admin/users/${adminId}`);
    await expect(page.getByRole("button", { name: "Blokovat" })).toHaveCount(
      0,
    );

    const taxonomyResponse = await page.goto("/admin/taxonomy");
    expect(taxonomyResponse?.status()).toBe(403);
  });
});

test.describe("Neprivilegovaný uživatel", () => {
  test.use({ storageState: STORAGE_STATE });

  test("nedostane admin UI ani přes přímou URL", async ({ page }) => {
    const response = await page.goto("/admin/users");
    expect(response?.status()).toBe(403);
  });
});
