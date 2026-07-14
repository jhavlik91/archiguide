import { expect, test } from "@playwright/test";
import { registerViaUi, uniqueEmail } from "./auth-helpers";
import { db } from "./db";

test.afterAll(async () => {
  await db.$disconnect();
});

/**
 * T034 — veřejné vyhledávání profesionálů (`/profesionalove`).
 *
 * Publikuje jednoho profesionála s unikátním, diakritickým titulkem a druhého
 * nechá v draftu. Ověřuje fulltext (i bez diakritiky), filtr region, prázdný
 * výsledek s návrhem dalšího kroku a to, že se DRAFT profil nikdy neobjeví.
 */

/** Projde onboardingem, doplní titulek a publikuje profil. */
async function publishProfile(
  page: import("@playwright/test").Page,
  headline: string,
): Promise<void> {
  await page.goto("/profile");
  await page
    .getByRole("button", { name: "Aktivovat profesionální účet" })
    .click();
  await page.waitForURL("**/profile/onboarding");

  // Krok 1 — profese.
  await page.getByRole("checkbox").first().check();
  await page.getByRole("button", { name: "Uložit a pokračovat" }).click();
  // Krok 2 — lokalita.
  await page.getByLabel("Lokalita").fill("Praha");
  await page.getByRole("button", { name: "Uložit a pokračovat" }).click();
  // Krok 3 — specializace.
  await page.getByLabel("Specializace").fill("dřevostavby");
  await page.getByRole("button", { name: "Uložit a pokračovat" }).click();
  // Krok 4 — dostupnost: přeskočit.
  await page.getByRole("button", { name: "Přeskočit" }).click();
  await page.waitForURL("**/profile");

  await page.getByLabel("Titulek").fill(headline);
  await page.getByRole("button", { name: "Uložit", exact: true }).click();
  await expect(page.getByText("Základní informace uloženy.")).toBeVisible();
  await page.getByRole("button", { name: "Publikovat" }).click();
  await expect(page.getByText("Publikováno")).toBeVisible();
}

test("vyhledávání: fulltext, diakritika, region, prázdný stav, draft skrytý", async ({
  page,
  browser,
}) => {
  const token = `xq${Date.now().toString(36)}`;
  const headline = `Truhlář ${token} na míru`;

  // Publikovaný profesionál.
  await registerViaUi(page, uniqueEmail("search-pub"), "test-password-123");
  await publishProfile(page, headline);

  // Druhý uživatel — profil zůstane v draftu (nesmí se objevit ve výsledcích).
  const draftHeadline = `Skrytý truhlář ${token}`;
  const draftContext = await browser.newContext();
  const draftPage = await draftContext.newPage();
  await registerViaUi(
    draftPage,
    uniqueEmail("search-draft"),
    "test-password-123",
  );
  await draftPage.goto("/profile");
  await draftPage
    .getByRole("button", { name: "Aktivovat profesionální účet" })
    .click();
  await draftPage.waitForURL("**/profile/onboarding");
  await draftPage.getByRole("checkbox").first().check();
  await draftPage.getByRole("button", { name: "Uložit a pokračovat" }).click();
  for (let i = 0; i < 3; i++) {
    await draftPage.getByRole("button", { name: "Přeskočit" }).click();
  }
  await draftPage.waitForURL("**/profile");
  await draftPage.getByLabel("Titulek").fill(draftHeadline);
  await draftPage.getByRole("button", { name: "Uložit", exact: true }).click();
  await expect(
    draftPage.getByText("Základní informace uloženy."),
  ).toBeVisible();
  await draftContext.close();

  // Anonymní návštěvník: fulltext bez diakritiky najde publikovaný profil.
  const guest = await browser.newContext();
  const gp = await guest.newPage();
  await gp.goto(`/profesionalove?q=truhlar+${token}`);
  await expect(gp.getByRole("heading", { name: headline })).toBeVisible();

  // Diakritika: „Truhlář" (s diakritikou) vrací stejný profil.
  await gp.goto(`/profesionalove?q=Truhlář+${token}`);
  await expect(gp.getByRole("heading", { name: headline })).toBeVisible();

  // Draft se nikdy neobjeví, ani při shodě na jeho titulek.
  await expect(gp.getByText(draftHeadline)).toHaveCount(0);

  // Filtr region: Praha najde, Ostrava ne.
  await gp.goto(`/profesionalove?q=${token}&region=Praha`);
  await expect(gp.getByRole("heading", { name: headline })).toBeVisible();
  await gp.goto(`/profesionalove?q=${token}&region=Ostrava`);
  await expect(
    gp.getByText("Žádní profesionálové neodpovídají zadání"),
  ).toBeVisible();
  // Prázdný výsledek nabídne konkrétní krok (rozšířit region).
  await expect(
    gp.getByRole("link", { name: /Hledat ve všech regionech/ }),
  ).toBeVisible();

  await guest.close();
});
