import { expect, test, type Page } from "@playwright/test";
import { loginAndWait, registerViaUi, uniqueEmail } from "./auth-helpers";
import {
  getUserIdByEmail,
  seedPublishedRequest,
  seedRequestInvite,
} from "./db";

/**
 * T024 — Poptávka: CRUD + stavový model. Ověřuje akceptační kritéria e2e:
 * brief → vytvoření poptávky → publikace → pauza → obnovení; publikace vyžaduje
 * doplnění povinných polí; nepřihlášený se k poptávkám nedostane.
 *
 * T025 — Poptávka: viditelnost + anonymizace. Přidává: veřejná/soukromá
 * poptávka na `/poptavka/[id]`, pozvánka (`RequestInvite` — seedovaná do DB,
 * UI vstupní bod přijde s T029), sanitizační varování před zveřejněním.
 *
 * T026 — Poptávky: výpis + detail. Přidává: veřejný výpis `/poptavky`
 * (publikace → objeví se ve výpisu → detail zobrazí anonymizovanou verzi;
 * pauza ji z výpisu skryje), filtr dle profese, CTA „reagovat" pro
 * nepřihlášeného (login, ne chyba) a mobilní layout (filtry v draweru).
 */

const PASSWORD = "dev-password-123";

async function logout(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Odhlásit se" }).click();
  await page.waitForURL("**/login");
}

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

test("viditelnost: výchozí soukromá skryje poptávku, veřejná ji zpřístupní anonymnímu návštěvníkovi", async ({
  page,
}) => {
  const email = uniqueEmail("visibility-a");
  await registerViaUi(page, email, PASSWORD);
  const requestUrl = await createRequestFromGuide(page);
  const requestId = requestUrl.split("/requests/")[1]!;

  await page.getByLabel("Region").fill("Praha a okolí");
  await page.getByRole("button", { name: "Uložit poptávku" }).click();
  await page.getByRole("button", { name: "Publikovat" }).click();
  await expect(
    page.getByText("Aktivní", { exact: true }).first(),
  ).toBeVisible();

  // Výchozí soukromá poptávka — anonymní návštěvník ji vůbec nevidí (404,
  // neprozrazuje existenci).
  await logout(page);
  const privateRes = await page.goto(`/poptavka/${requestId}`);
  expect(privateRes?.status()).toBe(404);

  // Vlastník přepne na veřejnou (žádné PII v textu → bez potvrzovacího dialogu).
  await loginAndWait(page, email, PASSWORD);
  await page.goto(`/requests/${requestId}`);
  await page.getByRole("radio", { name: "Veřejná" }).click();
  await expect(page.getByText("Poptávka je teď veřejná.")).toBeVisible();

  // Anonymní návštěvník teď vidí anonymizovanou verzi — jen povolená pole.
  await logout(page);
  const publicRes = await page.goto(`/poptavka/${requestId}`);
  expect(publicRes?.status()).toBe(200);
  await expect(
    page.getByText("Anonymizovaný náhled poptávky", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText("Praha a okolí")).toBeVisible();
});

test("neveřejnou poptávku vidí jen vlastník a pozvaný profesionál, cizí uživatel ne", async ({
  page,
}) => {
  const ownerEmail = uniqueEmail("visibility-owner");
  const proEmail = uniqueEmail("visibility-pro");
  const strangerEmail = uniqueEmail("visibility-stranger");

  await registerViaUi(page, ownerEmail, PASSWORD);
  const requestUrl = await createRequestFromGuide(page);
  const requestId = requestUrl.split("/requests/")[1]!;
  await page.getByLabel("Region").fill("Brno");
  await page.getByRole("button", { name: "Uložit poptávku" }).click();
  await page.getByRole("button", { name: "Publikovat" }).click();
  await expect(
    page.getByText("Aktivní", { exact: true }).first(),
  ).toBeVisible();
  // Poptávka zůstává soukromá (výchozí) — necháme tak.

  await logout(page);
  await registerViaUi(page, proEmail, PASSWORD);
  const proId = await getUserIdByEmail(proEmail);
  await logout(page);
  await registerViaUi(page, strangerEmail, PASSWORD);

  // Cizí přihlášený uživatel (bez pozvánky) → 404.
  const strangerRes = await page.goto(`/poptavka/${requestId}`);
  expect(strangerRes?.status()).toBe(404);

  // Pozvánka (T029 UI zatím neexistuje — seedujeme přímo do DB).
  await seedRequestInvite(requestId, proId);

  // 404 stránka je pod veřejným layoutem (bez „Odhlásit se") — odhlášení
  // provedeme až po návratu do aplikace.
  await page.goto("/dashboard");
  await logout(page);
  await loginAndWait(page, proEmail, PASSWORD);
  const invitedRes = await page.goto(`/poptavka/${requestId}`);
  expect(invitedRes?.status()).toBe(200);
  await expect(page.getByText("Brno")).toBeVisible();
});

test("telefon v regionu vyvolá varování před zveřejněním; potvrzení zveřejní", async ({
  page,
}) => {
  const email = uniqueEmail("visibility-phone");
  await registerViaUi(page, email, PASSWORD);
  const requestUrl = await createRequestFromGuide(page);
  const requestId = requestUrl.split("/requests/")[1]!;

  await page.getByLabel("Region").fill("Praha, volejte 608123456");
  await page.getByRole("button", { name: "Uložit poptávku" }).click();
  await page.getByRole("button", { name: "Publikovat" }).click();
  await expect(
    page.getByText("Aktivní", { exact: true }).first(),
  ).toBeVisible();

  await page.getByRole("radio", { name: "Veřejná" }).click();
  await expect(
    page.getByText("Text možná obsahuje osobní údaje"),
  ).toBeVisible();
  await expect(page.getByText(/telefonní číslo/)).toBeVisible();

  await page.getByRole("button", { name: "Pokračovat přesto" }).click();
  await expect(page.getByText("Poptávka je teď veřejná.")).toBeVisible();

  await logout(page);
  const res = await page.goto(`/poptavka/${requestId}`);
  expect(res?.status()).toBe(200);
});

test("výpis: publikace → objeví se ve výpisu → detail anonymizovaný; pauza ji skryje; CTA reagovat vede na přihlášení", async ({
  page,
}) => {
  const email = uniqueEmail("listing-owner");
  const token = uniqueEmail("").replace(/[^a-z0-9]/gi, "").slice(0, 12);
  const region = `Listing region ${token}`;

  await registerViaUi(page, email, PASSWORD);
  const requestUrl = await createRequestFromGuide(page);
  const requestId = requestUrl.split("/requests/")[1]!;

  await page.getByLabel("Region").fill(region);
  await page.getByRole("button", { name: "Uložit poptávku" }).click();
  await page.getByRole("button", { name: "Publikovat" }).click();
  await expect(
    page.getByText("Aktivní", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("radio", { name: "Veřejná" }).click();
  await expect(page.getByText("Poptávka je teď veřejná.")).toBeVisible();

  // Anonymní návštěvník: aktivní veřejná poptávka se objeví ve výpisu.
  await logout(page);
  await page.goto("/poptavky");
  await expect(page.getByText(region)).toBeVisible();

  // Detail z výpisu: anonymizovaná verze + CTA reagovat vede na přihlášení
  // (nepřihlášený, ne chyba — § Acceptance criteria).
  await page.getByText(region).click();
  await page.waitForURL(`**/poptavka/${requestId}`);
  await expect(
    page.getByText("Anonymizovaný náhled poptávky", { exact: false }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Reagovat na poptávku" }).click();
  await page.waitForURL(`**/login**`);

  // Vlastník poptávku pozastaví — zmizí z výpisu, detail stav komunikuje a
  // CTA je deaktivované s vysvětlením.
  await loginAndWait(page, email, PASSWORD);
  await page.goto(`/requests/${requestId}`);
  await page.getByRole("button", { name: "Pozastavit" }).click();
  await expect(
    page.getByText("Pozastavená", { exact: true }).first(),
  ).toBeVisible();

  await logout(page);
  await page.goto("/poptavky");
  await expect(page.getByText(region)).not.toBeVisible();

  const pausedRes = await page.goto(`/poptavka/${requestId}`);
  expect(pausedRes?.status()).toBe(200);
  await expect(page.getByText("Pozastavená", { exact: true })).toBeVisible();
  await expect(page.getByText(/reagovat nelze/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Reagovat na poptávku" }),
  ).toHaveCount(0);
});

test("výpis: filtr dle profese vrací jen odpovídající poptávky", async ({
  page,
}) => {
  const email = uniqueEmail("listing-filter");
  await registerViaUi(page, email, PASSWORD);
  const ownerId = await getUserIdByEmail(email);

  const token = uniqueEmail("").replace(/[^a-z0-9]/gi, "").slice(0, 12);
  const architectTitle = `Poptávka architekt ${token}`;
  const gardenTitle = `Poptávka zahradní architekt ${token}`;

  await seedPublishedRequest({
    ownerUserId: ownerId,
    title: architectTitle,
    professionSlugs: ["architekt"],
    region: "Praha",
  });
  await seedPublishedRequest({
    ownerUserId: ownerId,
    title: gardenTitle,
    professionSlugs: ["zahradni-architekt"],
    region: "Brno",
  });

  await logout(page);

  await page.goto("/poptavky?profese=architekt");
  await expect(page.getByText(architectTitle)).toBeVisible();
  await expect(page.getByText(gardenTitle)).not.toBeVisible();

  await page.goto("/poptavky?profese=zahradni-architekt");
  await expect(page.getByText(gardenTitle)).toBeVisible();
  await expect(page.getByText(architectTitle)).not.toBeVisible();
});

test("výpis: mobilní layout — filtry jsou schované v draweru", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await page.goto("/poptavky");

  const filterToggle = page.getByRole("button", { name: "Filtry" });
  await expect(filterToggle).toBeVisible();
  await expect(page.getByLabel("Profese")).not.toBeVisible();

  await filterToggle.click();
  await expect(page.getByLabel("Profese")).toBeVisible();
  await expect(page.getByLabel("Region")).toBeVisible();
});
