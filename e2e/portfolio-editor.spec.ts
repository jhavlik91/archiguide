import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { registerViaUi, uniqueEmail } from "./auth-helpers";
import { db, grantRoleByEmail } from "./db";

test.afterAll(async () => {
  await db.$disconnect();
});

/** Malý validní PNG jako upload payload do knihovny médií. */
async function pngBytes(): Promise<Buffer> {
  return sharp({
    create: {
      width: 320,
      height: 240,
      channels: 3,
      background: { r: 90, g: 140, b: 210 },
    },
  })
    .png()
    .toBuffer();
}

/** Otevře paletu a přidá blok podle nápovědy typu (unikátní text v paletě). */
async function addBlock(page: Page, hint: RegExp): Promise<void> {
  await page.getByRole("button", { name: "Přidat blok" }).click();
  await page.getByRole("button", { name: hint }).click();
}

/** Pořadí bloků v editoru podle `data-block-type` (drží řazení dokumentu). */
async function blockOrder(page: Page): Promise<(string | null)[]> {
  return page
    .locator("li[data-block-type]")
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-block-type")));
}

/**
 * T013 — blokový editor portfolia. Hlavní akceptační scénář: přidání textu +
 * galerie + before/after → přeřazení → autosave → reload → obsah zachován
 * (T013 § Acceptance criteria).
 */
test("sestavení díla z bloků, přeřazení, autosave a zachování po reloadu", async ({
  page,
}) => {
  const email = uniqueEmail("pf-editor");
  await registerViaUi(page, email, "test-password-123");
  // Vlastní portfolio zakládá profesionál (T012 § Permissions); roli přidáme
  // přímo v DB — actor ji čte z DB při každém requestu, takže se hned projeví.
  await grantRoleByEmail(email, "professional");

  // Založ nové dílo → přejde rovnou do blokového editoru.
  await page.goto("/portfolio");
  await page.getByRole("button", { name: "Nové dílo" }).first().click();
  await page.getByLabel("Název").fill("E2E dílo — rekonstrukce");
  await page.getByRole("button", { name: "Vytvořit a otevřít" }).click();
  await page.waitForURL("**/portfolio/**");
  await expect(
    page.getByRole("heading", { name: "Údaje o díle" }),
  ).toBeVisible();

  const TEXT = "Kompletní rekonstrukce bytu v pražských Dejvicích.";

  // 1) Text blok.
  await addBlock(page, /Odstavce textu/);
  await page
    .getByPlaceholder("Odstavce oddělte prázdným řádkem.")
    .fill(TEXT);

  // 2) Galerie — nahraj obrázek přímo z pickeru a vlož ho.
  await addBlock(page, /Více obrázků/);
  await page.getByRole("button", { name: "Přidat obrázky" }).click();
  const galleryDialog = page.getByRole("dialog");
  await galleryDialog.locator('input[type="file"]').setInputFiles({
    name: "interier.png",
    mimeType: "image/png",
    buffer: await pngBytes(),
  });
  const uploaded = galleryDialog.locator("button[aria-pressed]").first();
  await expect(uploaded).toBeVisible({ timeout: 15_000 });
  await uploaded.click();
  await galleryDialog.getByRole("button", { name: /Přidat vybrané/ }).click();
  await expect(
    page.locator('li[data-block-type="gallery"] img'),
  ).toHaveCount(1);

  // 3) Před / po — obě strany vyber z knihovny (asset už tam je).
  await addBlock(page, /Porovnání dvou obrázků/);
  const baBlock = page.locator('li[data-block-type="before_after"]');
  // „Před": po výběru se z tlačítka „Vybrat obrázek" stane „Změnit", takže
  // zbývající „Vybrat obrázek" je vždy ten druhý (dosud prázdný) slot.
  await baBlock.getByRole("button", { name: "Vybrat obrázek" }).first().click();
  await page.getByRole("dialog").locator("button:has(img)").first().click();
  await baBlock.getByRole("button", { name: "Vybrat obrázek" }).first().click();
  await page.getByRole("dialog").locator("button:has(img)").first().click();
  await expect(baBlock.locator("img")).toHaveCount(2);

  // 4) Přeřazení: posuň galerii nad text (tlačítko „Nahoru").
  await page
    .locator('li[data-block-type="gallery"]')
    .getByRole("button", { name: "Nahoru" })
    .click();
  expect(await blockOrder(page)).toEqual(["gallery", "text", "before_after"]);

  // 5) Autosave doběhne do stavu „Uloženo".
  await expect(page.getByText("Uloženo", { exact: true })).toBeVisible({
    timeout: 20_000,
  });

  // 6) Reload → obsah i pořadí zachovány (žádná tichá ztráta dat).
  await page.reload();
  await expect(
    page.getByPlaceholder("Odstavce oddělte prázdným řádkem."),
  ).toHaveValue(TEXT);
  expect(await blockOrder(page)).toEqual(["gallery", "text", "before_after"]);
  await expect(
    page.locator('li[data-block-type="gallery"] img'),
  ).toHaveCount(1);
  await expect(
    page.locator('li[data-block-type="before_after"] img'),
  ).toHaveCount(2);
});

/**
 * Undo/redo cílí na strukturu dokumentu (přidání/smazání/přeřazení, T013 § AC).
 */
test("undo/redo přidání a smazání bloku", async ({ page }) => {
  const email = uniqueEmail("pf-undo");
  await registerViaUi(page, email, "test-password-123");
  await grantRoleByEmail(email, "professional");

  await page.goto("/portfolio");
  await page.getByRole("button", { name: "Nové dílo" }).first().click();
  await page.getByLabel("Název").fill("E2E dílo — undo/redo");
  await page.getByRole("button", { name: "Vytvořit a otevřít" }).click();
  await page.waitForURL("**/portfolio/**");

  await addBlock(page, /Mezinadpis sekce/); // heading
  await addBlock(page, /Zvýrazněná citace/); // quote
  expect(await blockOrder(page)).toEqual(["heading", "quote"]);

  // Undo přidání citace → zůstane jen nadpis.
  await page.getByRole("button", { name: "Zpět" }).click();
  expect(await blockOrder(page)).toEqual(["heading"]);

  // Redo → citace zpět.
  await page.getByRole("button", { name: "Znovu" }).click();
  expect(await blockOrder(page)).toEqual(["heading", "quote"]);

  // Smazání nadpisu a undo ho vrátí.
  await page
    .locator('li[data-block-type="heading"]')
    .getByRole("button", { name: "Smazat" })
    .click();
  expect(await blockOrder(page)).toEqual(["quote"]);
  await page.getByRole("button", { name: "Zpět" }).click();
  expect(await blockOrder(page)).toEqual(["heading", "quote"]);
});
