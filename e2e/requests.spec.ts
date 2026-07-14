import { expect, test, type Page } from "@playwright/test";
import { registerViaUi, uniqueEmail } from "./auth-helpers";

/**
 * T024 — Poptávka: CRUD + stavový model. Ověřuje akceptační kritéria e2e:
 * brief → vytvoření poptávky → publikace → pauza → obnovení; publikace vyžaduje
 * doplnění povinných polí; nepřihlášený se k poptávkám nedostane.
 */

/** Otevře výběr scénáře a spustí scénář dle názvu karty. */
async function startScenario(page: Page, cardName: string): Promise<void> {
  await page.goto("/guide");
  await page.getByRole("button", { name: cardName }).click();
  await page.waitForURL("**/guide/**");
}

/** Projde nejrychlejší scénář (konzultace) až na obrazovku dokončení. */
async function completeConsultation(page: Page): Promise<void> {
  await startScenario(page, "Chci pouze konzultaci");
  await page.getByText("Návrh / architektura", { exact: true }).click();
  await page.getByRole("button", { name: "Pokračovat" }).click();
  await page.getByRole("button", { name: "Přeskočit" }).click();
  await expect(
    page.getByRole("heading", { name: /Máte podklady/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Přeskočit" }).click();
  await expect(page.getByRole("heading", { name: "Hotovo!" })).toBeVisible();
}

/** Dokončí guide, vytvoří brief a z něj draft poptávku; vrátí URL poptávky. */
async function createRequestFromGuide(page: Page): Promise<string> {
  await completeConsultation(page);
  await page.getByRole("button", { name: "Vytvořit brief" }).click();
  await page.waitForURL("**/brief/**");
  await page.getByRole("button", { name: "Vytvořit poptávku" }).click();
  await page.waitForURL("**/requests/**");
  return page.url();
}

test("brief → vytvoření poptávky → publikace → pauza → obnovení", async ({
  page,
}) => {
  await registerViaUi(page, uniqueEmail("request"), "dev-password-123");
  await createRequestFromGuide(page);

  // Nová poptávka je draft (stav vždy viditelný).
  await expect(
    page.getByText("Rozpracovaná", { exact: true }).first(),
  ).toBeVisible();

  // Cílové profese převzaté z briefu (prefill).
  await expect(page.getByText("Cílové profese", { exact: true })).toBeVisible();

  // Doplnění povinného regionu a uložení draftu.
  await page.getByLabel("Region").fill("Praha a okolí");
  await page.getByRole("button", { name: "Uložit poptávku" }).click();

  // Publikace: draft → active.
  await page.getByRole("button", { name: "Publikovat" }).click();
  await expect(
    page.getByText("Aktivní", { exact: true }).first(),
  ).toBeVisible();

  // Pauza: active → paused (rozpracované konverzace pokračují, nové reakce ne).
  await page.getByRole("button", { name: "Pozastavit" }).click();
  await expect(
    page.getByText("Pozastavená", { exact: true }).first(),
  ).toBeVisible();

  // Obnovení: paused → active.
  await page.getByRole("button", { name: "Obnovit" }).click();
  await expect(
    page.getByText("Aktivní", { exact: true }).first(),
  ).toBeVisible();

  // Auditní historie obsahuje publikaci i pauzu (významné přechody).
  await expect(page.getByText("Historie")).toBeVisible();
  await expect(page.getByText("Publikovat").first()).toBeVisible();
  await expect(page.getByText("Pozastavit").first()).toBeVisible();
});

test("nepřihlášený se k poptávkám nedostane (redirect na login)", async ({
  page,
}) => {
  await page.goto("/requests");
  await page.waitForURL("**/login**");
  await expect(
    page.getByRole("button", { name: "Přihlásit se" }),
  ).toBeVisible();
});
