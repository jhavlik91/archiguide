import { expect, test } from "@playwright/test";
import {
  fetchResetLink,
  loginViaUi,
  registerViaUi,
  uniqueEmail,
} from "./auth-helpers";

const PASSWORD = "test-password-123";

test.describe("Auth flow", () => {
  test("registrace → logout → login → přístup do aplikace", async ({
    page,
  }) => {
    const email = uniqueEmail("flow");

    await registerViaUi(page, email, PASSWORD);
    await expect(page.getByRole("heading", { name: "Přehled" })).toBeVisible();

    await page.getByRole("button", { name: "Odhlásit se" }).click();
    await page.waitForURL("**/login");

    await loginViaUi(page, email, PASSWORD);
    await page.waitForURL("**/dashboard");
    await expect(
      page.getByRole("navigation", { name: "Navigace aplikace" }),
    ).toBeVisible();
  });

  test("nepřihlášený je přesměrován na login a po přihlášení vrácen zpět", async ({
    page,
  }) => {
    const email = uniqueEmail("return");
    await registerViaUi(page, email, PASSWORD);
    await page.getByRole("button", { name: "Odhlásit se" }).click();
    await page.waitForURL("**/login");

    // Přístup na chráněnou routu bez session → redirect s návratovou URL.
    await page.goto("/dashboard");
    await page.waitForURL(/\/login\?returnUrl=/);
    expect(decodeURIComponent(page.url())).toContain("returnUrl=/dashboard");

    // Po přihlášení se vrátíme na původně požadovanou stránku.
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Heslo").fill(PASSWORD);
    await page.getByRole("button", { name: "Přihlásit se" }).click();
    await page.waitForURL("**/dashboard");
  });

  test("chybné heslo přihlášení odmítne", async ({ page }) => {
    const email = uniqueEmail("bad");
    await registerViaUi(page, email, PASSWORD);
    await page.getByRole("button", { name: "Odhlásit se" }).click();
    await page.waitForURL("**/login");

    await loginViaUi(page, email, "spatne-heslo-999");
    await expect(page.getByText(/Nesprávný e-mail nebo heslo/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("reset hesla end-to-end (token je jednorázový)", async ({ page }) => {
    const email = uniqueEmail("reset");
    const newPassword = "nove-heslo-456";

    await registerViaUi(page, email, PASSWORD);
    await page.getByRole("button", { name: "Odhlásit se" }).click();
    await page.waitForURL("**/login");

    // Vyžádání odkazu.
    await page.goto("/reset-password");
    await page.getByLabel("E-mail").fill(email);
    await page
      .getByRole("button", { name: "Poslat odkaz pro obnovení" })
      .click();
    await expect(page.getByText(/poslali jsme/i)).toBeVisible();

    // Získání odkazu z dev outboxu a nastavení nového hesla.
    const link = await fetchResetLink(page, email);
    await page.goto(link);
    await page.getByLabel("Nové heslo").fill(newPassword);
    await page.getByRole("button", { name: "Nastavit nové heslo" }).click();
    await page.waitForURL(/\/login\?reset=1/);

    // Přihlášení novým heslem funguje.
    await loginViaUi(page, email, newPassword);
    await page.waitForURL("**/dashboard");

    // Druhé použití téhož odkazu selže (jednorázovost).
    await page.goto(link);
    await page.getByLabel("Nové heslo").fill("jineheslo789");
    await page.getByRole("button", { name: "Nastavit nové heslo" }).click();
    await expect(
      page.getByText(/Odkaz je neplatný nebo vypršel/i),
    ).toBeVisible();
  });
});
