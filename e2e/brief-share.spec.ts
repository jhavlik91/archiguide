import { expect, test, type Page } from "@playwright/test";
import { registerViaUi, uniqueEmail } from "./auth-helpers";

/**
 * T022 — Brief: editace, sdílení, export. Ověřuje akceptační kritéria:
 *  - editace sekce → autosave → sdílení odkazem → anonymní read-only zobrazení,
 *  - odvolaný odkaz přestane fungovat okamžitě,
 *  - sdílení s přesnou adresou v textu zobrazí (neblokující) varování,
 *  - export bez explicitního zahrnutí neobsahuje soukromá pole,
 *  - úprava po sdílení přepne stav na „revised" a vlastník to vidí.
 */

/** Projde nejrychlejší scénář (konzultace) a vytvoří z něj brief; vrátí URL briefu. */
async function createBrief(page: Page): Promise<string> {
  await page.goto("/guide");
  await page.getByRole("button", { name: "Chci pouze konzultaci" }).click();
  await page.waitForURL("**/guide/**");
  await page.getByText("Návrh / architektura", { exact: true }).click();
  await page.getByRole("button", { name: "Pokračovat" }).click();
  await page.getByRole("button", { name: "Přeskočit" }).click();
  await expect(
    page.getByRole("heading", { name: /Máte podklady/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Přeskočit" }).click();
  await expect(page.getByRole("heading", { name: "Hotovo!" })).toBeVisible();
  await page.getByRole("button", { name: "Vytvořit brief" }).click();
  await page.waitForURL("**/brief/**");
  return page.url();
}

/** Otevře editor, upraví shrnutí a přes „Hotovo" se vrátí na náhled. */
async function editSummary(page: Page, text: string): Promise<void> {
  await page.getByRole("link", { name: "Upravit brief" }).click();
  await page.waitForURL("**/upravit");
  await page.getByLabel("Shrnutí záměru").fill(text);
  await expect(page.getByText("Uloženo")).toBeVisible();
  await page.getByRole("button", { name: "Hotovo" }).click();
  await page.waitForURL(/\/brief\/[^/]+$/);
}

test("editace → autosave → sdílení → anonymní read-only; úprava po sdílení = revised", async ({
  page,
  browser,
}) => {
  await registerViaUi(page, uniqueEmail("brief-share"), "dev-password-123");
  await createBrief(page);

  await editSummary(page, "Upravené shrnutí pro sdílení.");

  // Sdílení odkazem (bez osobních údajů → bez varování).
  await page.getByRole("button", { name: "Sdílet odkazem" }).click();
  const shareInput = page.getByLabel("Sdílený odkaz");
  await expect(shareInput).toBeVisible();
  const shareUrl = await shareInput.inputValue();
  expect(shareUrl).toContain("/sdileny-brief/");

  // Anonymní zobrazení sdílené read-only verze (čerstvý kontext bez přihlášení).
  const anon = await browser.newContext();
  const anonPage = await anon.newPage();
  await anonPage.goto(shareUrl);
  await expect(anonPage.getByText("jen ke čtení")).toBeVisible();
  await expect(
    anonPage.getByText("Upravené shrnutí pro sdílení."),
  ).toBeVisible();
  await anon.close();

  // Úprava po sdílení → stav revised, vlastník vidí, že sdílená verze je starší.
  await editSummary(page, "Ještě novější shrnutí.");
  await expect(page.getByText("Revidovaný", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Sdílená verze je starší než vaše úpravy."),
  ).toBeVisible();
});

test("odvolaný odkaz přestane fungovat okamžitě", async ({ page, browser }) => {
  await registerViaUi(page, uniqueEmail("brief-revoke"), "dev-password-123");
  await createBrief(page);

  await page.getByRole("button", { name: "Sdílet odkazem" }).click();
  const shareUrl = await page.getByLabel("Sdílený odkaz").inputValue();

  const anon = await browser.newContext();
  const anonPage = await anon.newPage();
  await anonPage.goto(shareUrl);
  await expect(anonPage.getByText("jen ke čtení")).toBeVisible();

  // Odvolání → panel se vrátí do stavu „nesdíleno".
  await page.getByRole("button", { name: "Odvolat odkaz" }).click();
  await expect(
    page.getByRole("button", { name: "Sdílet odkazem" }),
  ).toBeVisible();

  // Týž odkaz už nefunguje.
  await anonPage.goto(shareUrl);
  await expect(
    anonPage.getByRole("heading", { name: "Odkaz již není platný" }),
  ).toBeVisible();
  await anon.close();
});

test("sdílení briefu s přesnou adresou v textu zobrazí varování", async ({
  page,
}) => {
  await registerViaUi(page, uniqueEmail("brief-privacy"), "dev-password-123");
  await createBrief(page);

  await editSummary(
    page,
    "Bydlím na adrese Dlouhá 12, 110 00 Praha, volejte 777 123 456.",
  );

  await page.getByRole("button", { name: "Sdílet odkazem" }).click();
  // Neblokující varování → uživatel může sdílet přesto.
  await expect(
    page.getByText("Text možná obsahuje osobní údaje"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sdílet přesto" }).click();
  await expect(page.getByLabel("Sdílený odkaz")).toBeVisible();
});

test("export neobsahuje soukromá pole bez explicitního zahrnutí", async ({
  page,
}) => {
  await registerViaUi(page, uniqueEmail("brief-export"), "dev-password-123");
  await createBrief(page);

  // Doplníme veřejnou lokalitu + soukromou přesnou adresu.
  await page.getByRole("link", { name: "Upravit brief" }).click();
  await page.waitForURL("**/upravit");
  await page.getByLabel("Město / region (veřejné)").fill("Praha");
  await page.getByLabel("Přesná adresa (soukromá)").fill("Dlouhá 12");
  await expect(page.getByText("Uloženo")).toBeVisible();
  await page.getByRole("button", { name: "Hotovo" }).click();
  await page.waitForURL(/\/brief\/[^/]+$/);

  await page.getByRole("link", { name: "Export" }).click();
  await page.waitForURL("**/export");
  // Veřejná lokalita ano, přesná adresa ne.
  await expect(page.getByText("Praha")).toBeVisible();
  await expect(page.getByText("Dlouhá 12")).toHaveCount(0);

  // Explicitní zahrnutí soukromých polí → adresa se objeví.
  await page.getByRole("link", { name: /Zahrnout soukromá pole/ }).click();
  await page.waitForURL("**/export?soukrome=1");
  await expect(page.getByText(/Dlouhá 12/)).toBeVisible();
});
