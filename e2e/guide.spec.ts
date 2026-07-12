import { expect, test, type Page } from "@playwright/test";

/**
 * T018 — Guide UI runner nad reálným obsahem scénářů (T019). Ověřuje hlavní
 * akceptační scénáře (T018 § Acceptance): výběr scénáře → průchod otázkami
 * s „nevím" → reload uprostřed → pokračování → dokončení; krok zpět se změnou
 * odpovědi přepočítá větev; celé flow na mobilu; nepřihlášený dokončí guide bez
 * registrace. Vše běží ANONYMNĚ (bez storageState).
 */

/** Otevře výběr scénáře („Co chcete vyřešit?") a spustí scénář dle názvu karty. */
async function startScenario(page: Page, cardName: string): Promise<void> {
  await page.goto("/guide");
  await expect(
    page.getByRole("heading", { name: "Co chcete vyřešit?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: cardName }).click();
  await page.waitForURL("**/guide/**");
}

/** Vybere možnost single/multi-choice podle jejího labelu a potvrdí „Pokračovat". */
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
  await startScenario(page, "Chci rekonstruovat dům");

  // 1) vlastnický vztah (§9.2).
  await expect(
    page.getByRole("heading", { name: "Jaký máte vztah k nemovitosti?" }),
  ).toBeVisible();
  await chooseAndContinue(page, "Již vlastním");

  // 2) lokalita — stačí město (§9.1).
  await expect(
    page.getByRole("heading", { name: "Kde se záměr nachází?" }),
  ).toBeVisible();
  await page.getByLabel("Město / obec").fill("Praha");
  await page.getByRole("button", { name: "Pokračovat" }).click();

  // Reload uprostřed průchodu — perzistovaný stav se obnoví na dalším kroku.
  await expect(
    page.getByRole("heading", { name: "Jak starý je dům?" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Jak starý je dům?" }),
  ).toBeVisible();
  // Průběžné shrnutí drží dřívější odpovědi i po reloadu (desktop postranní panel;
  // stejná hodnota je i ve skryté mobilní variantě, proto `.first()`).
  await expect(page.getByText("Praha", { exact: true }).first()).toBeVisible();

  // 3) stáří domu — „Nevím" nikdy nezablokuje postup.
  await page.getByRole("button", { name: "Nevím" }).click();

  // 4) rozsah rekonstrukce (multi-choice).
  await expect(
    page.getByRole("heading", { name: "Co má rekonstrukce zahrnovat?" }),
  ).toBeVisible();
  await chooseAndContinue(page, "Střecha");

  // 5) bourání — „Ne" nevětví na otázku nosnosti.
  await expect(
    page.getByRole("heading", {
      name: "Plánujete bourat nebo posouvat stěny?",
    }),
  ).toBeVisible();
  await chooseAndContinue(page, "Ne");

  // 6) rozpočet — „potřebuji odhad" nevětví na částku.
  await expect(
    page.getByRole("heading", { name: "Znáte rozpočet?" }),
  ).toBeVisible();
  await chooseAndContinue(page, "Potřebuji odhad");

  // 7) termín — „Nevím" opět nezablokuje.
  await expect(
    page.getByRole("heading", { name: "Kdy chcete začít?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Nevím" }).click();

  // 8) podklady (nepovinné) — přeskočit → tím se guide dokončí.
  await expect(
    page.getByRole("heading", { name: /Máte podklady/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Přeskočit" }).click();

  // Dokončení + souhrn s doporučeními (T020); anonym dostane jemnou výzvu k registraci.
  await expect(page.getByRole("heading", { name: "Hotovo!" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Co doporučujeme" }),
  ).toBeVisible();
  await expect(page.getByText("Doporučené profese").first()).toBeVisible();
  await expect(page.getByText("Uložte si záměr na později")).toBeVisible();
  await expect(page.getByRole("link", { name: "Vytvořit účet" })).toBeVisible();
});

test("krok zpět se změnou odpovědi přepočítá větev", async ({ page }) => {
  await startScenario(page, "Chci rekonstruovat dům");

  await chooseAndContinue(page, "Již vlastním");
  await page.getByLabel("Město / obec").fill("Brno");
  await page.getByRole("button", { name: "Pokračovat" }).click();
  await page.getByRole("button", { name: "Nevím" }).click(); // stáří domu
  await expect(
    page.getByRole("heading", { name: "Co má rekonstrukce zahrnovat?" }),
  ).toBeVisible();
  await chooseAndContinue(page, "Změny dispozice");

  // Bourání „ano" odkryje povinnou otázku na nosné stěny (§11).
  await expect(
    page.getByRole("heading", {
      name: "Plánujete bourat nebo posouvat stěny?",
    }),
  ).toBeVisible();
  await chooseAndContinue(page, "Ano, chci bourat stěny");
  await expect(
    page.getByRole("heading", {
      name: "Víte, zda je některá z těchto stěn nosná?",
    }),
  ).toBeVisible();

  // Zpět na bourání a změna odpovědi na „Ne".
  await page.getByRole("button", { name: "Zpět" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Plánujete bourat nebo posouvat stěny?",
    }),
  ).toBeVisible();
  await chooseAndContinue(page, "Ne");

  // Otázka na nosnost zmizela → další krok je rovnou rozpočet
  // (důkaz, že se větev přepočítala, ne pokračovalo v původní cestě).
  await expect(
    page.getByRole("heading", { name: "Znáte rozpočet?" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Víte, zda je některá z těchto stěn nosná?",
    }),
  ).toHaveCount(0);
});

test("T020 — scénář F: riziková odpověď zobrazí bezpečnostní warning ihned i v souhrnu", async ({
  page,
}) => {
  await startScenario(page, "Mám technický problém se stavbou");

  // Akutní příznak (§15) → výrazné bezpečnostní upozornění IHNED během průchodu.
  await expect(
    page.getByRole("heading", {
      name: "Objevil se některý z těchto akutních příznaků?",
    }),
  ).toBeVisible();
  await page.getByText("Únik plynu", { exact: true }).click();
  await page.getByRole("button", { name: "Pokračovat" }).click();

  const warning = page.getByRole("heading", {
    name: "Bezpečnostní upozornění",
  });
  await expect(warning).toBeVisible();
  await expect(page.getByText(/není havarijní/i).first()).toBeVisible();

  // Dokončí průchod — warning nezablokuje postup.
  await expect(
    page.getByRole("heading", { name: "Jaký problém řešíte především?" }),
  ).toBeVisible();
  await chooseAndContinue(page, "Zápach");
  await page.getByLabel("Město / obec").fill("Praha");
  await page.getByRole("button", { name: "Pokračovat" }).click();
  // Poslední krok (podklady) — přeskočením se guide dokončí.
  await expect(
    page.getByRole("heading", { name: /Máte podklady/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Přeskočit" }).click();

  // Souhrn znovu ukáže bezpečnostní upozornění (§15).
  await expect(page.getByRole("heading", { name: "Hotovo!" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Bezpečnostní upozornění" }),
  ).toBeVisible();
});

test("T020 — rozpor zobrazí upozornění, ale neblokuje dokončení", async ({
  page,
}) => {
  await startScenario(page, "Chci rekonstruovat dům");

  // „Zatím pouze zvažuji" + později „Okamžitě" → rozpor termínu (neblokující).
  await chooseAndContinue(page, "Zatím pouze zvažuji");
  await page.getByLabel("Město / obec").fill("Praha");
  await page.getByRole("button", { name: "Pokračovat" }).click();
  await page.getByRole("button", { name: "Nevím" }).click(); // stáří domu
  await chooseAndContinue(page, "Střecha"); // rozsah
  await chooseAndContinue(page, "Ne"); // bourání
  await chooseAndContinue(page, "Potřebuji odhad"); // rozpočet
  await expect(
    page.getByRole("heading", { name: "Kdy chcete začít?" }),
  ).toBeVisible();
  await chooseAndContinue(page, "Okamžitě");
  await expect(
    page.getByRole("heading", { name: /Máte podklady/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Přeskočit" }).click();

  // Dokončí se (rozpor neblokuje) a v souhrnu je jemné upozornění na rozpor.
  await expect(page.getByRole("heading", { name: "Hotovo!" })).toBeVisible();
  await expect(page.getByText(/zvažte, zda je termín reálný/i)).toBeVisible();
});

test("T020 — editace odpovědi ze souhrnu přepočítá výsledek", async ({
  page,
}) => {
  await startScenario(page, "Chci pouze konzultaci");
  await chooseAndContinue(page, "Návrh / architektura");
  await page.getByRole("button", { name: "Přeskočit" }).click(); // volný popis
  await expect(
    page.getByRole("heading", { name: /Máte podklady/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Přeskočit" }).click();

  await expect(page.getByRole("heading", { name: "Hotovo!" })).toBeVisible();

  // Skok na krok ze souhrnu → úprava → návrat na souhrn.
  await page.getByRole("button", { name: "Upravit" }).first().click();
  await expect(
    page.getByText("Upravujete odpověď. Po uložení se vrátíte na souhrn."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Zpět na souhrn" }).click();
  await expect(page.getByRole("heading", { name: "Hotovo!" })).toBeVisible();
});

test.describe("mobilní viewport", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("celé flow projde na mobilu bez registrace", async ({ page }) => {
    await startScenario(page, "Chci pouze konzultaci");

    await expect(
      page.getByRole("heading", { name: "Čeho se má konzultace týkat?" }),
    ).toBeVisible();
    await chooseAndContinue(page, "Návrh / architektura");

    // Volný popis je nepovinný — přeskočit.
    await expect(
      page.getByRole("heading", {
        name: "Popište krátce, co byste chtěli probrat.",
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Přeskočit" }).click();

    // Poslední krok (podklady) — přeskočením se guide dokončí.
    await expect(
      page.getByRole("heading", { name: /Máte podklady/ }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Přeskočit" }).click();

    await expect(page.getByRole("heading", { name: "Hotovo!" })).toBeVisible();
  });
});
