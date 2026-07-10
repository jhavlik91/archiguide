import { expect, test } from "@playwright/test";
import { registerViaUi, uniqueEmail } from "./auth-helpers";
import { db } from "./db";

test.afterAll(async () => {
  await db.$disconnect();
});

/**
 * T008 — veřejná stránka profilu. Publikuje profil profesionála a ověřuje:
 * anonymní zobrazení, použitelnost na mobilu, 404 draftu pro cizího, náhled
 * vlastníka a to, že se nikde nevykreslují kontaktní údaje.
 */
test("veřejný profil: publikace, anonym, mobil, draft 404, náhled vlastníka", async ({
  page,
  browser,
}) => {
  const email = uniqueEmail("public");
  const headline = "Architekt pro rodinné domy";
  await registerViaUi(page, email, "test-password-123");

  // Stát se profesionálem + onboarding (vyber profesi, zbytek přeskoč).
  await page.goto("/profile");
  await page
    .getByRole("button", { name: "Aktivovat profesionální účet" })
    .click();
  await page.waitForURL("**/profile/onboarding");
  await page.getByRole("checkbox").first().check();
  await page.getByRole("button", { name: "Uložit a pokračovat" }).click();
  await page.getByRole("button", { name: "Přeskočit" }).click(); // lokalita
  await page.getByRole("button", { name: "Přeskočit" }).click(); // specializace
  await page.getByRole("button", { name: "Přeskočit" }).click(); // dostupnost
  await page.waitForURL("**/profile");

  // Doplň titulek a publikuj.
  await page.getByLabel("Titulek").fill(headline);
  await page.getByRole("button", { name: "Uložit", exact: true }).click();
  await expect(page.getByText("Základní informace uloženy.")).toBeVisible();
  await page.getByRole("button", { name: "Publikovat" }).click();
  await expect(page.getByText("Publikováno")).toBeVisible();

  // Slug se generuje serverově — přečti ho z DB pro sestavení veřejné URL.
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  const profile = await db.professionalProfile.findUniqueOrThrow({
    where: { userId: user.id },
  });
  expect(profile.slug, "publikovaný profil má slug").toBeTruthy();
  const slug = profile.slug as string;
  const url = `/profesional/${slug}`;

  // --- Anonymní návštěvník vidí publikovaný profil ---
  const anon = await browser.newContext();
  const anonPage = await anon.newPage();
  const res = await anonPage.goto(url);
  expect(res?.status()).toBe(200);
  await expect(
    anonPage.getByRole("heading", { name: headline, level: 1 }),
  ).toBeVisible();
  // Nepřihlášený dostane výzvu k registraci, ne kontaktní údaje.
  await expect(
    anonPage.getByRole("link", { name: /Zaregistrovat se/ }),
  ).toBeVisible();
  // Kontaktní e-mail se nikde nevykresluje (private by default).
  await expect(anonPage.getByText(email)).toHaveCount(0);

  // --- Mobilní viewport je použitelný, bez vodorovného přetečení ---
  await anonPage.setViewportSize({ width: 375, height: 812 });
  await expect(
    anonPage.getByRole("heading", { name: headline, level: 1 }),
  ).toBeVisible();
  const overflows = await anonPage.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(overflows, "stránka nepřetéká vodorovně").toBe(false);

  // --- Draft vrací cizímu (anonymnímu) 404 ---
  await db.professionalProfile.update({
    where: { userId: user.id },
    data: { status: "draft" },
  });
  const draftRes = await anonPage.goto(url);
  expect(draftRes?.status()).toBe(404);
  await anon.close();

  // --- Vlastník si draft zobrazí v náhledu (?preview=1) ---
  const previewRes = await page.goto(`${url}?preview=1`);
  expect(previewRes?.status()).toBe(200);
  await expect(page.getByText("Náhled draftu")).toBeVisible();
  // Bez preview flagu je draft 404 i pro vlastníka.
  const ownerNoPreview = await page.goto(url);
  expect(ownerNoPreview?.status()).toBe(404);
});
