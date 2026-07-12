import { expect, test, type Page } from "@playwright/test";

/**
 * T018 — Guide UI runner. Ověřuje hlavní akceptační scénáře (T018 § Acceptance):
 * výběr scénáře → průchod otázkami s „nevím" → reload uprostřed → pokračování →
 * dokončení; krok zpět se změnou odpovědi přepočítá větev; celé flow na mobilu;
 * nepřihlášený dokončí guide bez registrace. Vše běží ANONYMNĚ (bez storageState).
 */

/** Otevře výběr scénáře a spustí hlavní scénář „Co chcete vyřešit?". */
async function startMainScenario(page: Page): Promise<void> {
  await page.goto("/guide");
  await expect(
    page.getByRole("heading", { name: "Co chcete vyřešit?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Co chcete vyřešit?" }).click();
  await page.waitForURL("**/guide/**");
}

/** Vybere možnost single-choice podle jejího labelu a potvrdí „Pokračovat". */
async function chooseAndContinue(
  page: Page,
  optionLabel: string,
): Promise<void> {
  await page.getByText(optionLabel, { exact: true }).click();
  await page.getByRole("button", { name: "Pokračovat" }).click();
}

test("výběr scénáře → otázky s „nevím“ → reload uprostřed → dokončení", async ({
  page,
}) => {
  await startMainScenario(page);

  // 1) intent — rekonstrukce (rozvětví na lokalitu, vlastnictví, podklady).
  await expect(
    page.getByRole("heading", { name: "Co chcete vyřešit?" }),
  ).toBeVisible();
  await chooseAndContinue(page, "Chci rekonstruovat dům nebo byt");

  // 2) lokalita — stačí město.
  await expect(
    page.getByRole("heading", { name: "Kde se záměr nachází?" }),
  ).toBeVisible();
  await page.getByLabel("Město / obec").fill("Praha");
  await page.getByRole("button", { name: "Pokračovat" }).click();

  // Reload uprostřed průchodu — perzistovaný stav se obnoví na dalším kroku.
  await expect(
    page.getByRole("heading", { name: "Jaký máte vztah k nemovitosti?" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Jaký máte vztah k nemovitosti?" }),
  ).toBeVisible();
  // Průběžné shrnutí drží dřívější odpovědi i po reloadu (desktop postranní panel;
  // stejná hodnota je i ve skryté mobilní variantě, proto `.first()`).
  await expect(page.getByText("Praha", { exact: true }).first()).toBeVisible();

  // 3) vlastnictví.
  await chooseAndContinue(page, "Již vlastním");

  // 4) rozpočet — „potřebuji odhad" nevětví na částku.
  await expect(
    page.getByRole("heading", { name: "Znáte rozpočet?" }),
  ).toBeVisible();
  await chooseAndContinue(page, "Potřebuji odhad");

  // 5) termín — „Nevím" nikdy nezablokuje postup.
  await expect(
    page.getByRole("heading", { name: "Kdy chcete začít?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Nevím" }).click();

  // 6) podklady (nepovinné) — přeskočit → tím se guide dokončí.
  await expect(
    page.getByRole("heading", { name: /Máte podklady/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Přeskočit" }).click();

  // Dokončení + rekapitulace; anonym dostane jemnou (nepovinnou) výzvu k registraci.
  await expect(page.getByRole("heading", { name: "Hotovo!" })).toBeVisible();
  await expect(page.getByText("Uložte si svůj záměr")).toBeVisible();
  await expect(page.getByRole("link", { name: "Vytvořit účet" })).toBeVisible();
});

test("krok zpět se změnou odpovědi přepočítá větev", async ({ page }) => {
  await startMainScenario(page);

  // Nový dům → větev s fází stavby, bez otázky na vlastnictví.
  await chooseAndContinue(page, "Chci postavit nový dům");
  await expect(
    page.getByRole("heading", { name: "Kde se záměr nachází?" }),
  ).toBeVisible();

  // Zpět na první otázku a změna záměru na „pouze konzultaci".
  await page.getByRole("button", { name: "Zpět" }).click();
  await expect(
    page.getByRole("heading", { name: "Co chcete vyřešit?" }),
  ).toBeVisible();
  await chooseAndContinue(page, "Chci pouze konzultaci");

  // Konzultace nemá lokalitu ani fázi stavby → další otázka je rovnou rozpočet
  // (důkaz, že se větev přepočítala, ne pokračovalo v původní cestě).
  await expect(
    page.getByRole("heading", { name: "Znáte rozpočet?" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Kde se záměr nachází?" }),
  ).toHaveCount(0);
});

test.describe("mobilní viewport", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("celé flow projde na mobilu bez registrace", async ({ page }) => {
    await startMainScenario(page);

    await chooseAndContinue(page, "Chci pouze konzultaci");
    await expect(
      page.getByRole("heading", { name: "Znáte rozpočet?" }),
    ).toBeVisible();
    await chooseAndContinue(page, "Neznám");
    await expect(
      page.getByRole("heading", { name: "Kdy chcete začít?" }),
    ).toBeVisible();
    // Poslední viditelný krok → primární akce se jmenuje „Dokončit".
    await page.getByText("Do 3 měsíců", { exact: true }).click();
    await page.getByRole("button", { name: "Dokončit" }).click();

    await expect(page.getByRole("heading", { name: "Hotovo!" })).toBeVisible();
  });
});
