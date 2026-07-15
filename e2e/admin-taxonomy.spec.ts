import { expect, test } from "@playwright/test";
import { ADMIN_STATE, registerViaUi, uniqueEmail } from "./auth-helpers";
import { db, grantRoleByEmail } from "./db";

test.afterAll(async () => {
  await db.$disconnect();
});

/**
 * Admin — správa taxonomie (T035 § Main flow 4). Jen admin (na rozdíl od
 * výpisu uživatelů moderátor sem nemá přístup vůbec). CRUD kategorie a
 * profese, deaktivace místo mazání a duplicitní varování.
 */

test.describe("Admin spravuje taxonomii", () => {
  test.use({ storageState: ADMIN_STATE });

  test("založí kategorii a profesi, deaktivuje a znovu aktivuje profesi", async ({
    page,
  }) => {
    const suffix = Date.now();
    const categoryName = `E2E kategorie ${suffix}`;
    const professionName = `E2E profese ${suffix}`;

    await page.goto("/admin/taxonomy");

    await page.getByRole("button", { name: "Nová kategorie" }).click();
    await page.getByLabel("Název").fill(categoryName);
    await page.getByRole("button", { name: "Uložit" }).click();
    await expect(
      page.getByRole("heading", { name: categoryName }),
    ).toBeVisible();

    // Karta kategorie = dva rodiče nad titulkem (h2 → CardHeader → Card).
    const card = page
      .getByRole("heading", { name: categoryName })
      .locator("../..");
    await card.getByRole("button", { name: "Nová profese" }).click();
    await page.getByLabel("Název").fill(professionName);
    await page.getByRole("button", { name: "Uložit" }).click();

    // Řádek profese = dva rodiče nad jejím názvem (p → div.min-w-0 → row).
    const professionRow = page
      .getByText(professionName, { exact: true })
      .locator("../..");
    await expect(professionRow.getByText("Aktivní")).toBeVisible();

    // Deaktivace — zmizí z veřejného výběru (T035 AC), ale zůstává v adminu.
    await page
      .getByRole("button", { name: `Deaktivovat ${professionName}` })
      .click();
    await expect(professionRow.getByText("Archivovaná")).toBeVisible();

    await page.goto("/profesionalove");
    await page.getByRole("combobox", { name: /profese/i }).click();
    await expect(
      page.getByRole("option", { name: professionName }),
    ).toHaveCount(0);
    await page.keyboard.press("Escape");

    // Reaktivace vrátí profesi do veřejného výběru.
    await page.goto("/admin/taxonomy");
    await page
      .getByRole("button", { name: `Aktivovat ${professionName}` })
      .click();
    await expect(professionRow.getByText("Aktivní")).toBeVisible();
  });

  test("varuje na duplicitní profesi, ale umožní pokračovat", async ({
    page,
  }) => {
    await page.goto("/admin/taxonomy");
    // `level: 2` vybere titulek kategorie, ne stránkové h1 "Taxonomie".
    const firstCategory = page.getByRole("heading", { level: 2 }).first();
    const card = firstCategory.locator("..").locator("..");
    await card.getByRole("button", { name: "Nová profese" }).click();
    // "Topenář" existuje v seedu (T005) — vytvoření druhé se stejným názvem
    // musí vyvolat varování o duplicitě.
    await page.getByLabel("Název").fill("Topenář");
    await page.getByRole("button", { name: "Uložit" }).click();
    await expect(page.getByText(/Podobná profese už existuje/)).toBeVisible();
    await page.getByRole("button", { name: "Zrušit" }).click();
  });
});

test.describe("Moderátor nemá přístup k taxonomii", () => {
  test("dostane 403", async ({ page }) => {
    const email = uniqueEmail("moderator-taxonomy");
    await registerViaUi(page, email, "test-password-123");
    await grantRoleByEmail(email, "moderator");

    const response = await page.goto("/admin/taxonomy");
    expect(response?.status()).toBe(403);
  });
});
