import { expect, test } from "@playwright/test";
import { registerViaUi, uniqueEmail } from "./auth-helpers";
import { db } from "./db";

test.afterAll(async () => {
  await db.$disconnect();
});

/**
 * T010 — veřejná stránka firmy. Založí firmu a ověřuje: anonymní zobrazení,
 * použitelnost na mobilu, opt-in do týmu (člen bez souhlasu se nezobrazí) a
 * 404 archivované firmy.
 */
test("veřejná firma: anonym, mobil, opt-in týmu, archiv 404", async ({
  page,
  browser,
}) => {
  const email = uniqueEmail("org-public");
  const orgName = `Studio ${Date.now()}`;
  await registerViaUi(page, email, "test-password-123");

  // Založení firmy → přesměrování na detail.
  await page.goto("/organizations");
  await page.getByLabel("Název firmy").fill(orgName);
  await page.getByRole("button", { name: "Založit firmu" }).click();
  await page.waitForURL(/\/organizations\/[a-z0-9]+$/);

  // Slug vzniká serverově při založení — přečti ho z DB pro veřejnou URL.
  const org = await db.organization.findFirstOrThrow({
    where: { name: orgName },
  });
  expect(org.slug, "založená firma má slug").toBeTruthy();
  const url = `/firma/${org.slug}`;

  // --- Anonymní návštěvník vidí aktivní firmu ---
  const anon = await browser.newContext();
  const anonPage = await anon.newPage();
  const res = await anonPage.goto(url);
  expect(res?.status()).toBe(200);
  await expect(
    anonPage.getByRole("heading", { name: orgName, level: 1 }),
  ).toBeVisible();

  // Owner zatím nedal opt-in → sekce „Tým" se nezobrazuje a jeho e-mail nikde není.
  await expect(anonPage.getByText("Tým", { exact: true })).toHaveCount(0);
  await expect(anonPage.getByText(email)).toHaveCount(0);

  // --- Mobilní viewport je použitelný, bez vodorovného přetečení ---
  await anonPage.setViewportSize({ width: 375, height: 812 });
  await expect(
    anonPage.getByRole("heading", { name: orgName, level: 1 }),
  ).toBeVisible();
  const overflows = await anonPage.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(overflows, "stránka nepřetéká vodorovně").toBe(false);

  // --- Owner dá opt-in do veřejného týmu ---
  // Stav checkboxu se aktualizuje až po serverové akci + router.refresh, proto
  // klikáme a úspěch ověříme přes toast (ne přes okamžitou změnu stavu).
  await page.getByLabel("Zobrazovat mě ve veřejném týmu firmy").click();
  await expect(page.getByText("Jste vidět ve veřejném týmu.")).toBeVisible();

  // Teď se sekce „Tým" anonymovi zobrazí i s členem (bez profilu = neutrální jméno).
  await anonPage.goto(url);
  await expect(anonPage.getByText("Tým", { exact: true })).toBeVisible();
  await expect(anonPage.getByText("Člen týmu")).toBeVisible();

  // --- Archivovaná firma vrací 404 ---
  await db.organization.update({
    where: { id: org.id },
    data: { status: "archived" },
  });
  const archivedRes = await anonPage.goto(url);
  expect(archivedRes?.status()).toBe(404);

  await anon.close();
});
