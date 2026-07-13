import { expect, test, type Page } from "@playwright/test";
import { registerViaUi, uniqueEmail } from "./auth-helpers";

/**
 * T021 — Brief generovaný z guide. Ověřuje akceptační kritéria: dokončený guide →
 * brief se všemi povinnými sekcemi §18; „nevím" u rozpočtu → „neuveden" (žádné
 * vymyšlené číslo); nový brief je draft + soukromý; opakované generování
 * nevytvoří duplicitu; nepřihlášený je před vytvořením vyzván k registraci.
 */

/** Otevře výběr scénáře a spustí scénář dle názvu karty; vrátí URL session. */
async function startScenario(page: Page, cardName: string): Promise<string> {
  await page.goto("/guide");
  await page.getByRole("button", { name: cardName }).click();
  await page.waitForURL("**/guide/**");
  return page.url();
}

/** Projde nejrychlejší scénář (konzultace) až na obrazovku dokončení. */
async function completeConsultation(page: Page): Promise<string> {
  const sessionUrl = await startScenario(page, "Chci pouze konzultaci");
  await page.getByText("Návrh / architektura", { exact: true }).click();
  await page.getByRole("button", { name: "Pokračovat" }).click();
  // Volný popis (nepovinný) → přeskočit.
  await page.getByRole("button", { name: "Přeskočit" }).click();
  // Podklady → přeskočit → guide se dokončí.
  await expect(
    page.getByRole("heading", { name: /Máte podklady/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Přeskočit" }).click();
  await expect(page.getByRole("heading", { name: "Hotovo!" })).toBeVisible();
  return sessionUrl;
}

test("přihlášený: dokončený guide → brief se všemi sekcemi §18, draft + soukromý", async ({
  page,
}) => {
  await registerViaUi(page, uniqueEmail("brief"), "dev-password-123");

  await completeConsultation(page);

  // Vytvoření briefu z obrazovky dokončení.
  await page.getByRole("button", { name: "Vytvořit brief" }).click();
  await page.waitForURL("**/brief/**");

  // Nový brief je draft + soukromý (acceptance).
  await expect(page.getByText("Rozpracovaný", { exact: true })).toBeVisible();
  await expect(page.getByText("Soukromý", { exact: true })).toBeVisible();

  // Povinné sekce §18.
  await expect(page.getByRole("heading", { name: "Shrnutí" })).toBeVisible();
  await expect(page.getByText("Typ projektu")).toBeVisible();
  await expect(page.getByText("Rozpočet", { exact: true })).toBeVisible();
  // Konzultace nemá otázku na rozpočet → poctivě „neuveden", žádné číslo (acceptance).
  await expect(page.getByText("Rozpočet neuveden")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Doporučené profese" }),
  ).toBeVisible();
  await expect(page.getByText("Doporučený další krok")).toBeVisible();

  // Uložení (draft → ready).
  await page.getByRole("button", { name: "Uložit brief" }).click();
  await expect(page.getByText("Připravený", { exact: true })).toBeVisible();
});

test("opakované generování z téže session nevytvoří duplicitní brief", async ({
  page,
}) => {
  await registerViaUi(page, uniqueEmail("brief-dup"), "dev-password-123");

  const sessionUrl = await completeConsultation(page);

  await page.getByRole("button", { name: "Vytvořit brief" }).click();
  await page.waitForURL("**/brief/**");
  const firstBriefUrl = page.url();

  // Návrat na dokončený guide a opětovné „Vytvořit brief" → tentýž brief (draft se
  // jen aktualizuje, nezaloží se duplicita).
  await page.goto(sessionUrl);
  await expect(page.getByRole("heading", { name: "Hotovo!" })).toBeVisible();
  await page.getByRole("button", { name: "Vytvořit brief" }).click();
  await page.waitForURL("**/brief/**");
  expect(page.url()).toBe(firstBriefUrl);
});

test("nepřihlášený je před vytvořením briefu vyzván k registraci", async ({
  page,
}) => {
  await completeConsultation(page);

  await page.getByRole("button", { name: "Vytvořit brief" }).click();
  // Matice „Vytvořit brief" = C → redirect na registraci s návratem na guide.
  await page.waitForURL("**/register**");
  await expect(
    page.getByRole("button", { name: "Vytvořit účet" }),
  ).toBeVisible();
});
