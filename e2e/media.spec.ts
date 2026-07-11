import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { registerViaUi, uniqueEmail } from "./auth-helpers";
import { db } from "./db";

test.afterAll(async () => {
  await db.$disconnect();
});

/** Malý validní PNG (barevná dlaždice) jako upload payload. */
async function pngBytes(): Promise<Buffer> {
  return sharp({
    create: {
      width: 320,
      height: 240,
      channels: 3,
      background: { r: 60, g: 120, b: 200 },
    },
  })
    .png()
    .toBuffer();
}

/**
 * T014 — knihovna médií. Happy path: přihlášený uživatel nahraje obrázek přes
 * knihovnu, vygenerují se deriváty a náhled se objeví v gridu (a jde ho servírovat
 * přes chráněnou routu). Ověřuje i odmítnutí nepodporovaného formátu.
 */
test("upload obrázku do knihovny a zobrazení v gridu", async ({ page }) => {
  await registerViaUi(page, uniqueEmail("media"), "test-password-123");

  await page.goto("/media");
  await expect(
    page.getByRole("heading", { name: "Knihovna médií" }),
  ).toBeVisible();
  // Prázdný stav na začátku.
  await expect(page.getByText("Zatím žádné obrázky")).toBeVisible();

  // Nahraj obrázek přes skrytý file input (tlačítko ho otevírá).
  await page.locator('input[type="file"]').setInputFiles({
    name: "vila.png",
    mimeType: "image/png",
    buffer: await pngBytes(),
  });

  // Náhled se objeví v gridu.
  const thumb = page.locator('img[src^="/api/media/"]').first();
  await expect(thumb).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Soubor nahrán.")).toBeVisible();

  // Derivát (thumbnail) se servíruje vlastníkovi přes chráněnou routu.
  const src = await thumb.getAttribute("src");
  expect(src).toContain("/thumbnail");
  const res = await page.request.get(src!);
  expect(res.ok()).toBeTruthy();
  expect(res.headers()["content-type"]).toContain("image/webp");
});

test("nepodporovaný formát je odmítnut se srozumitelnou hláškou", async ({
  page,
}) => {
  await registerViaUi(page, uniqueEmail("media-bad"), "test-password-123");
  await page.goto("/media");

  // Textový soubor přejmenovaný na .png — klientská předkontrola typu ho odmítne.
  await page.locator('input[type="file"]').setInputFiles({
    name: "fake.png",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  });

  await expect(page.getByText(/nepodporovaný formát/i)).toBeVisible();
  await expect(page.getByText("Zatím žádné obrázky")).toBeVisible();
});
