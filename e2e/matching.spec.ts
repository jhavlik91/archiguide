import { expect, test, type Page } from "@playwright/test";
import { loginAndWait, registerViaUi, uniqueEmail } from "./auth-helpers";
import {
  getUserIdByEmail,
  seedMatchRecommendation,
  seedPublishedProfessionalProfile,
} from "./db";

/**
 * T029 — Matching UI. Ověřuje acceptance kritéria: publikovaná poptávka →
 * seznam doporučení s důvody → shortlist → pozvání kandidáta; dismiss je
 * vratný; nikde se nezobrazuje procentní skóre.
 *
 * Kandidátní profil (T007) i samotné doporučení (T028 `MatchRecommendation`)
 * se seedují přímo do DB — engine má vlastní unit testy (`matching/service.test.ts`)
 * a přes guide/onboarding UI by test závisel na profesi, kterou zrovna doporučí
 * konzultace (křehké, viz `requests.spec.ts`). Testuje se UI nad hotovým
 * doporučením: záložky, akce (shortlist/dismiss/restore/invite), poctivé texty.
 */

const PASSWORD = "dev-password-123";

async function logout(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Odhlásit se" }).click();
  await page.waitForURL("**/login");
}

async function startScenario(page: Page, cardName: string): Promise<void> {
  await page.goto("/guide");
  await page.getByRole("button", { name: cardName }).click();
  await page.waitForURL("**/guide/**");
}

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

test("publikovaná poptávka → doporučení s důvody → shortlist/dismiss/restore → pozvání kandidáta", async ({
  page,
}) => {
  const token = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
  const proEmail = uniqueEmail("matching-pro");
  const ownerEmail = uniqueEmail("matching-owner");
  const headline = `Studio Novák ${token}`;

  // Kandidát — publikovaný profil, seedovaný přímo (rychlejší a spolehlivější
  // než onboarding wizard pro jediný přesně zadaný profil). Profese úmyslně
  // NEODPOVÍDÁ tomu, co doporučí konzultační scénář (architekt / interiérový
  // architekt) — jinak by ho po publikaci našel i REÁLNÝ přepočet enginu
  // (T028, spouští se automaticky při publikaci) a duplikoval doporučení vedle
  // toho, které tenhle test seeduje ručně níž.
  await registerViaUi(page, proEmail, PASSWORD);
  const proId = await getUserIdByEmail(proEmail);
  await seedPublishedProfessionalProfile({
    userId: proId,
    slug: `studio-novak-${token}`,
    headline,
    professionSlug: "elektrikar",
    location: "Praha",
  });
  await logout(page);

  // Vlastník — publikovaná poptávka (výchozí viditelnost zůstává soukromá).
  await registerViaUi(page, ownerEmail, PASSWORD);
  const requestUrl = await createRequestFromGuide(page);
  const requestId = requestUrl.split("/requests/")[1]!;
  await page.getByLabel("Region").fill("Praha a okolí");
  await page.getByRole("button", { name: "Uložit poptávku" }).click();
  await page.getByRole("button", { name: "Publikovat" }).click();
  await expect(
    page.getByText("Aktivní", { exact: true }).first(),
  ).toBeVisible();

  // Doporučení seedujeme až PO publikaci (přepočet enginu při publikaci by ho
  // beztak přepsal/smazal, kdyby profese neseděla s tou z briefu).
  await seedMatchRecommendation({
    requestId,
    candidateUserId: proId,
    reasons: [
      { type: "profession_match", detail: "Hlavní profese: Elektrikář." },
      { type: "region", detail: "Působí v regionu Praha." },
    ],
  });
  await page.reload();

  // Sekce doporučení: karta kandidáta s lidsky čitelným důvodem, žádné % skóre.
  await expect(
    page.getByText("Doporučení profesionálové", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: /Doporučení \(1\)/ }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: headline })).toBeVisible();
  await expect(
    page.getByText(
      "Doporučeno, protože hlavní profese: Elektrikář a působí v regionu Praha.",
    ),
  ).toBeVisible();
  await expect(page.getByText(/%/)).toHaveCount(0);

  // Dismiss je vratný.
  await page.getByRole("button", { name: "Skrýt" }).click();
  await expect(page.getByText("Kandidát skryt.")).toBeVisible();
  await expect(
    page.getByRole("tab", { name: /Doporučení \(0\)/ }),
  ).toBeVisible();
  await page.getByRole("tab", { name: /Skryté \(1\)/ }).click();
  await expect(page.getByRole("heading", { name: headline })).toBeVisible();
  await page.getByRole("button", { name: "Obnovit" }).click();
  await expect(page.getByText("Kandidát obnoven.")).toBeVisible();
  await expect(
    page.getByRole("tab", { name: /Doporučení \(1\)/ }),
  ).toBeVisible();

  // Shortlist.
  await page.getByRole("tab", { name: /Doporučení \(1\)/ }).click();
  await page.getByRole("button", { name: "Uložit do výběru" }).click();
  await expect(page.getByText("Uloženo do užšího výběru.")).toBeVisible();
  await page.getByRole("tab", { name: /Užší výběr \(1\)/ }).click();
  await expect(page.getByText("V užším výběru")).toBeVisible();

  // Pozvání kandidáta (neveřejná poptávka → reálná pozvánka, RequestInvite).
  await page.getByRole("button", { name: "Oslovit" }).click();
  await expect(page.getByText("Kandidát osloven.")).toBeVisible();

  // Pozvaný kandidát se teď na neveřejnou poptávku dostane.
  await logout(page);
  await loginAndWait(page, proEmail, PASSWORD);
  const invitedRes = await page.goto(`/poptavka/${requestId}`);
  expect(invitedRes?.status()).toBe(200);
});
