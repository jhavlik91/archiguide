import { expect, test, type Page } from "@playwright/test";
import {
  ADMIN_STATE,
  loginAndWait,
  registerViaUi,
  uniqueEmail,
} from "./auth-helpers";
import {
  db,
  getUserIdByEmail,
  grantRoleByEmail,
  seedDisputedReview,
  seedPublishedProfessionalProfile,
  seedPublishedRequest,
} from "./db";

/**
 * T037 — Hodnocení s ověřenou interakcí. Ověřuje acceptance kritéria e2e:
 * accepted reakce → výzva k hodnocení na detailu poptávky → odeslání →
 * recenze (s badge „ověřená spolupráce") na veřejném profilu hodnoceného →
 * hodnocený odpoví (§36.3) a rozporuje → příznak „Rozporováno" zůstává
 * veřejný; návštěvník reply/dispute akce nevidí.
 */

const PASSWORD = "dev-password-123";
const REVIEW_TEXT = "Skvělá spolupráce, doporučuji.";
const REPLY_TEXT = "Děkujeme za zpětnou vazbu.";

async function logout(page: Page): Promise<void> {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Odhlásit se" }).click();
  await page.waitForURL("**/login");
}

test("accepted reakce → výzva k hodnocení → recenze na profilu → odpověď a spor hodnoceného", async ({
  page,
}) => {
  const ownerEmail = uniqueEmail("rev-owner");
  const proEmail = uniqueEmail("rev-pro");
  const proSlug = `rev-pro-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

  await registerViaUi(page, ownerEmail, PASSWORD);
  const ownerId = await getUserIdByEmail(ownerEmail);
  const requestId = await seedPublishedRequest({
    ownerUserId: ownerId,
    title: "Rekonstrukce podkroví",
    professionSlugs: ["architekt"],
    region: "Praha",
  });

  // Profesionál s publikovaným profilem reaguje na poptávku.
  await logout(page);
  await registerViaUi(page, proEmail, PASSWORD);
  await grantRoleByEmail(proEmail, "professional");
  const proId = await getUserIdByEmail(proEmail);
  await seedPublishedProfessionalProfile({
    userId: proId,
    slug: proSlug,
    headline: "Architekt pro rekonstrukce",
    professionSlug: "architekt",
  });

  await page.goto(`/poptavka/${requestId}`);
  await page.getByLabel("Zpráva").fill("Rád projekt zpracuji.");
  await page.getByRole("button", { name: "Odeslat reakci" }).click();
  await expect(page.getByText("Odeslaná", { exact: true })).toBeVisible();

  // Vlastník: před přijetím reakce se výzva k hodnocení NEZOBRAZUJE.
  await logout(page);
  await loginAndWait(page, ownerEmail, PASSWORD);
  await page.goto(`/requests/${requestId}`);
  await expect(
    page.getByRole("button", { name: "Ohodnotit spolupráci" }),
  ).toHaveCount(0);

  // Přijetí reakce (viewed → shortlisted → accepted) → objeví se CTA hodnocení
  // (main flow bod 2).
  await page.getByRole("button", { name: "Na užší seznam" }).click();
  await expect(
    page.getByText("Na užším seznamu", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Přijmout" }).click();
  await expect(page.getByText("Přijatá", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Ohodnotit spolupráci" }).click();

  // Odeslat nejde, dokud nejsou ohodnocena všechna kritéria.
  await expect(
    page.getByRole("button", { name: "Odeslat hodnocení" }),
  ).toBeDisabled();
  for (const label of [
    "Komunikace",
    "Kvalita",
    "Termíny",
    "Transparentnost",
    "Profesionalita",
  ]) {
    await page
      .getByRole("radiogroup", { name: label })
      .getByRole("radio", { name: "5 z 5" })
      .click();
  }
  await page.getByLabel("Komentář (nepovinné)").fill(REVIEW_TEXT);
  await page.getByRole("button", { name: "Odeslat hodnocení" }).click();

  // V 24h okně CTA přepne na editaci (main flow bod 3).
  await expect(
    page.getByRole("button", { name: "Upravit hodnocení" }),
  ).toBeVisible();

  // Recenze je veřejná na profilu hodnoceného — bez PII recenzenta („Klient").
  await page.goto(`/profesional/${proSlug}`);
  await expect(
    page.getByText("Hodnocení z ověřených spoluprací"),
  ).toBeVisible();
  await expect(page.getByText(REVIEW_TEXT)).toBeVisible();
  await expect(page.getByText("Klient", { exact: true })).toBeVisible();
  await expect(page.getByText(ownerEmail)).toHaveCount(0);

  // Hodnocený na svém profilu odpoví (jedna veřejná odpověď, §36.3)…
  await logout(page);
  await loginAndWait(page, proEmail, PASSWORD);
  await page.goto(`/profesional/${proSlug}`);
  await page.getByRole("button", { name: "Odpovědět" }).click();
  await page.getByLabel("Vaše odpověď").fill(REPLY_TEXT);
  await page.getByRole("button", { name: "Odeslat odpověď" }).click();
  await expect(page.getByText("Odpověď hodnoceného")).toBeVisible();
  await expect(page.getByText(REPLY_TEXT)).toBeVisible();

  // …a recenzi rozporuje — zůstává veřejná s příznakem (main flow bod 6).
  await page.getByRole("button", { name: "Rozporovat" }).click();
  await page
    .getByLabel("Důvod sporu")
    .fill("Hodnocení neodpovídá průběhu zakázky.");
  await page.getByRole("button", { name: "Podat spor" }).click();
  await expect(page.getByText("Rozporováno", { exact: true })).toBeVisible();

  // Návštěvník vidí recenzi i příznak, ale žádné reply/dispute akce.
  await logout(page);
  await page.goto(`/profesional/${proSlug}`);
  await expect(page.getByText(REVIEW_TEXT)).toBeVisible();
  await expect(page.getByText("Rozporováno", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Odpovědět" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Rozporovat" })).toHaveCount(0);
});

test.describe("Moderace sporu (T037 × T036)", () => {
  test.use({ storageState: ADMIN_STATE });

  test("spor ve frontě → náhled recenze → hide → recenze zmizí z profilu", async ({
    page,
  }) => {
    const headline = `Architekt Modtest ${Date.now()}`;
    const proSlug = `rev-mod-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const pro = await db.user.create({
      data: { email: uniqueEmail("rev-mod-pro") },
    });
    await seedPublishedProfessionalProfile({
      userId: pro.id,
      slug: proSlug,
      headline,
      professionSlug: "architekt",
    });

    const badText = "Hrozná spolupráce, nedoporučuji nikomu.";
    const { reportId } = await seedDisputedReview({
      targetUserId: pro.id,
      text: badText,
    });

    // Před rozhodnutím moderátora je rozporovaná recenze dál veřejná.
    await page.goto(`/profesional/${proSlug}`);
    await expect(page.getByText(badText)).toBeVisible();
    await expect(page.getByText("Rozporováno", { exact: true })).toBeVisible();

    // Detail případu ukazuje náhled recenze (cíl, průměr, text).
    await page.goto(`/admin/reports/${reportId}`);
    await expect(page.getByText(`Hodnocení „${headline}“`)).toBeVisible();
    await expect(page.getByText(badText)).toBeVisible();

    // Moderátor recenzi skryje s povinným důvodem…
    await page.getByLabel("Typ akce").click();
    await page.getByRole("option", { name: "Skrýt obsah" }).click();
    await page
      .getByLabel(/Důvod \(povinný/)
      .fill("Recenze porušuje pravidla platformy.");
    await page.getByRole("button", { name: "Provést akci" }).click();
    await expect(page.getByText("Cíl je aktuálně skrytý.")).toBeVisible();

    // …a recenze zmizí z veřejného profilu (vyřazena z výpisu i průměru).
    await page.goto(`/profesional/${proSlug}`);
    await expect(page.getByText(badText)).toHaveCount(0);
  });
});
