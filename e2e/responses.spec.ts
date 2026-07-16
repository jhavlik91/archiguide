import { expect, test, type Page } from "@playwright/test";
import { loginAndWait, registerViaUi, uniqueEmail } from "./auth-helpers";
import { getUserIdByEmail, grantRoleByEmail, seedPublishedRequest } from "./db";

/**
 * T027 — Reakce profesionála na poptávku. Ověřuje akceptační kritéria e2e:
 * profesionál reaguje → vlastník vidí reakci (stav `viewed`) → shortlist →
 * accept → poptávka `in_discussion`; reakce na `paused` poptávku se nezaloží.
 */

const PASSWORD = "dev-password-123";

async function logout(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Odhlásit se" }).click();
  await page.waitForURL("**/login");
}

test("profesionál reaguje → vlastník vidí reakci (viewed) → shortlist → accept → poptávka in_discussion", async ({
  page,
}) => {
  const ownerEmail = uniqueEmail("resp-owner");
  const proEmail = uniqueEmail("resp-pro");

  await registerViaUi(page, ownerEmail, PASSWORD);
  const ownerId = await getUserIdByEmail(ownerEmail);
  const requestId = await seedPublishedRequest({
    ownerUserId: ownerId,
    title: "Rekonstrukce bytu v Praze",
    professionSlugs: ["architekt"],
    region: "Praha",
  });

  await logout(page);
  await registerViaUi(page, proEmail, PASSWORD);
  await grantRoleByEmail(proEmail, "professional");

  // Profesionál reaguje z veřejného detailu poptávky.
  await page.goto(`/poptavka/${requestId}`);
  await page.getByLabel("Zpráva").fill("Rád bych na projektu spolupracoval.");
  await page.getByRole("button", { name: "Odeslat reakci" }).click();
  await expect(page.getByText("Odeslaná", { exact: true })).toBeVisible();

  // Druhá reakce téhož profesionála se nezaloží — formulář teď edituje tu
  // existující (main flow bod 4), ne vytváří druhou.
  await expect(page.getByRole("button", { name: "Uložit úpravy" })).toBeVisible();

  // Vlastník otevře detail poptávky — čtení automaticky nastaví `viewed`.
  await page.goto("/dashboard");
  await logout(page);
  await loginAndWait(page, ownerEmail, PASSWORD);
  await page.goto(`/requests/${requestId}`);
  await expect(page.getByText("Zobrazená", { exact: true })).toBeVisible();

  // Shortlist.
  await page.getByRole("button", { name: "Na užší seznam" }).click();
  await expect(page.getByText("Na užším seznamu", { exact: true })).toBeVisible();

  // Přijetí reakce posune i poptávku do jednání (T024 přechod start_discussion).
  await page.getByRole("button", { name: "Přijmout" }).click();
  await expect(page.getByText("Přijatá", { exact: true })).toBeVisible();
  await expect(page.getByText("V jednání", { exact: true }).first()).toBeVisible();
});

test("reakce na pozastavenou poptávku se nezaloží — CTA vysvětlí důvod", async ({
  page,
}) => {
  const ownerEmail = uniqueEmail("resp-paused-owner");
  const proEmail = uniqueEmail("resp-paused-pro");

  await registerViaUi(page, ownerEmail, PASSWORD);
  const ownerId = await getUserIdByEmail(ownerEmail);
  const requestId = await seedPublishedRequest({
    ownerUserId: ownerId,
    title: "Poptávka pozastavená",
    professionSlugs: ["architekt"],
    region: "Brno",
    status: "paused",
  });

  await logout(page);
  await registerViaUi(page, proEmail, PASSWORD);
  await grantRoleByEmail(proEmail, "professional");

  await page.goto(`/poptavka/${requestId}`);
  await expect(page.getByText(/reagovat nelze/)).toBeVisible();
  await expect(page.getByLabel("Zpráva")).toHaveCount(0);
});
