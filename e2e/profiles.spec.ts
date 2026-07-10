import { expect, test } from "@playwright/test";
import { registerViaUi, uniqueEmail } from "./auth-helpers";
import { db } from "./db";

test.afterAll(async () => {
  await db.$disconnect();
});

/**
 * T007 — profesionální profil. Happy path: klient → self-service profesionál →
 * onboarding (profese, lokalita, specializace, dostupnost) → publikace profilu.
 * Ověřuje i to, že draft nelze publikovat bez profese/titulku.
 */
test("onboarding profesionála a publikace profilu", async ({ page }) => {
  await registerViaUi(page, uniqueEmail("profile"), "test-password-123");

  // Nový uživatel (klient) na /profile vidí nabídku stát se profesionálem.
  await page.goto("/profile");
  await page
    .getByRole("button", { name: "Aktivovat profesionální účet" })
    .click();

  // Přesměrování na onboarding wizard.
  await page.waitForURL("**/profile/onboarding");
  await expect(
    page.getByRole("heading", { name: "Založení profilu" }),
  ).toBeVisible();

  // Krok 1 — profese: vyber první profesi z taxonomie a pokračuj.
  await page.getByRole("checkbox").first().check();
  await expect(page.getByText("Vybrané profese")).toBeVisible();
  await page.getByRole("button", { name: "Uložit a pokračovat" }).click();

  // Krok 2 — lokalita.
  await page.getByLabel("Lokalita").fill("Praha");
  await page.getByRole("button", { name: "Uložit a pokračovat" }).click();

  // Krok 3 — specializace.
  await page.getByLabel("Specializace").fill("pasivní domy, rekonstrukce");
  await page.getByRole("button", { name: "Uložit a pokračovat" }).click();

  // Krok 4 — dostupnost → Dokončit → zpět na /profile.
  await page.getByRole("button", { name: "Dokončit" }).click();
  await page.waitForURL("**/profile");

  // Profil je zatím draft.
  await expect(page.getByText("Rozpracováno")).toBeVisible();

  // Bez titulku nelze publikovat (tlačítko je disabled).
  await expect(
    page.getByRole("button", { name: "Publikovat" }),
  ).toBeDisabled();

  // Doplň titulek v sekci Základ a ulož.
  await page
    .getByLabel("Titulek")
    .fill("Architekt se zaměřením na rodinné domy");
  await page.getByRole("button", { name: "Uložit", exact: true }).click();
  await expect(page.getByText("Základní informace uloženy.")).toBeVisible();

  // Teď lze publikovat.
  const publish = page.getByRole("button", { name: "Publikovat" });
  await expect(publish).toBeEnabled();
  await publish.click();

  await expect(page.getByText("Publikováno")).toBeVisible();
});

/**
 * „Přijímám poptávky" nelze zapnout bez profese. Ověřujeme přes DB stav: nový
 * profesionál bez profese → přepínač zapnutý neuloží (rule guard v service).
 */
test("příjem poptávek vyžaduje profesi", async ({ page }) => {
  const email = uniqueEmail("accepting");
  await registerViaUi(page, email, "test-password-123");

  await page.goto("/profile");
  await page
    .getByRole("button", { name: "Aktivovat profesionální účet" })
    .click();
  await page.waitForURL("**/profile/onboarding");

  // Přeskoč všechny kroky → draft profil bez profese.
  for (let i = 0; i < 4; i++) {
    await page.getByRole("button", { name: "Přeskočit" }).click();
  }
  await page.waitForURL("**/profile");

  // Zkus zapnout příjem poptávek → rule error, stav se neuloží.
  await page.getByRole("checkbox", { name: "Přijímám poptávky" }).check();
  await expect(
    page.getByText("Nejdřív vyberte alespoň jednu profesi."),
  ).toBeVisible();

  const user = await db.user.findUniqueOrThrow({ where: { email } });
  const profile = await db.professionalProfile.findUniqueOrThrow({
    where: { userId: user.id },
  });
  expect(profile.acceptingRequests).toBe(false);
});
