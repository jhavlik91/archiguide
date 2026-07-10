import { expect, test } from "@playwright/test";
import {
  fetchEmailLink,
  fetchSmsCode,
  registerViaUi,
  uniqueEmail,
} from "./auth-helpers";

const PASSWORD = "test-password-123";

/** Unikátní telefon v E.164, aby se testy nepletly ve sdíleném outboxu. */
function uniquePhone(): string {
  const suffix = String(Date.now()).slice(-9).padStart(9, "0");
  return `+420${suffix}`;
}

test.describe("Verifikace (T011)", () => {
  test("registrace → klik na odkaz → odznak „Ověřený e-mail“", async ({
    page,
  }) => {
    const email = uniqueEmail("verify-email");
    await registerViaUi(page, email, PASSWORD);

    // Po registraci je e-mail zatím jen čekající.
    await page.goto("/settings");
    await expect(page.getByText("Čeká na ověření")).toBeVisible();

    // Klik na verifikační odkaz z dev outboxu.
    const link = await fetchEmailLink(page, email);
    await page.goto(link);
    await page.waitForURL(/\/settings\?emailVerified=1/);

    await expect(page.getByText("E-mail byl úspěšně ověřen.")).toBeVisible();
    await expect(
      page.getByText("Ověřený e-mail", { exact: true }),
    ).toBeVisible();
  });

  test("telefon: kód z SMS → ověření → odznak „Ověřený telefon“", async ({
    page,
  }) => {
    const email = uniqueEmail("verify-phone");
    const phone = uniquePhone();
    await registerViaUi(page, email, PASSWORD);

    await page.goto("/settings");
    await page.getByLabel("Telefon").fill(phone);
    await page.getByRole("button", { name: "Poslat kód" }).click();
    await expect(page.getByLabel("Kód z SMS")).toBeVisible();

    const code = await fetchSmsCode(page, phone);
    await page.getByLabel("Kód z SMS").fill(code);
    await page.getByRole("button", { name: "Ověřit telefon" }).click();

    await expect(page.getByText("Ověřený telefon")).toBeVisible();
  });

  test("špatný kód telefon odmítne a hlásí zbývající pokusy", async ({
    page,
  }) => {
    const email = uniqueEmail("verify-phone-bad");
    const phone = uniquePhone();
    await registerViaUi(page, email, PASSWORD);

    await page.goto("/settings");
    await page.getByLabel("Telefon").fill(phone);
    await page.getByRole("button", { name: "Poslat kód" }).click();
    await page.getByLabel("Kód z SMS").fill("000000");
    await page.getByRole("button", { name: "Ověřit telefon" }).click();

    await expect(page.getByText(/Nesprávný kód/)).toBeVisible();
  });

  test("změna e-mailu resetuje ověření", async ({ page }) => {
    const email = uniqueEmail("verify-change");
    await registerViaUi(page, email, PASSWORD);

    // Nejdřív ověřit původní e-mail.
    const link = await fetchEmailLink(page, email);
    await page.goto(link);
    await page.waitForURL(/\/settings\?emailVerified=1/);
    await expect(
      page.getByText("Ověřený e-mail", { exact: true }),
    ).toBeVisible();

    // Změna e-mailu → ověření se resetuje na „čeká na ověření“.
    const newEmail = uniqueEmail("verify-changed");
    await page.getByRole("button", { name: "Změnit e-mail" }).click();
    await page.getByLabel("Nový e-mail").fill(newEmail);
    await page.getByRole("button", { name: "Změnit e-mail" }).click();

    await expect(page.getByText("Čeká na ověření")).toBeVisible();
    await expect(
      page.getByText("Ověřený e-mail", { exact: true }),
    ).toHaveCount(0);
  });
});
