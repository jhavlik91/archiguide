import { expect, test } from "@playwright/test";
import {
  ADMIN_STATE,
  DUAL_STATE,
  STORAGE_STATE,
  registerViaUi,
  uniqueEmail,
} from "./auth-helpers";
import { db, grantRoleByEmail } from "./db";

test.afterAll(async () => {
  await db.$disconnect();
});

// Bezrolový uživatel → 403 na (admin).
test.describe("(admin) bez role", () => {
  test.use({ storageState: STORAGE_STATE });

  test("vrátí 403 a stránku 'Nemáte oprávnění'", async ({ page }) => {
    const response = await page.goto("/admin");
    expect(response?.status()).toBe(403);
    await expect(
      page.getByRole("heading", { name: "Nemáte oprávnění" }),
    ).toBeVisible();
  });
});

// Admin → vidí administraci.
test.describe("(admin) s rolí admin", () => {
  test.use({ storageState: ADMIN_STATE });

  test("admin vidí administraci (200)", async ({ page }) => {
    const response = await page.goto("/admin");
    expect(response?.status()).toBe(200);
    await expect(page.getByText("Admin", { exact: true })).toBeVisible();
  });
});

// Přepínání kontextu u dual-role účtu.
test.describe("Přepínání kontextu", () => {
  test.use({ storageState: DUAL_STATE });

  test("dual-role uživatel přepne kontext a přepnutí přežije reload", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    const group = page.getByRole("group", { name: "Aktivní kontext" }).first();
    await expect(group).toBeVisible();

    const client = group.getByRole("button", { name: "Klient" });
    const professional = group.getByRole("button", { name: "Profesionál" });
    await expect(client).toHaveAttribute("aria-pressed", "true");

    // Počkáme na dokončení server action (zápis kontextu), ne jen na optimistický
    // stav — jinak by reload mohl předběhnout zápis cookie.
    await Promise.all([
      page.waitForResponse(
        (r) => r.request().method() === "POST" && r.status() === 200,
      ),
      professional.click(),
    ]);
    await expect(professional).toHaveAttribute("aria-pressed", "true");
    await page.waitForLoadState("networkidle");

    // Kontext je uložený v cookie session → přežije reload bez re-loginu.
    await page.reload();
    const groupAfter = page
      .getByRole("group", { name: "Aktivní kontext" })
      .first();
    await expect(
      groupAfter.getByRole("button", { name: "Profesionál" }),
    ).toHaveAttribute("aria-pressed", "true");
  });
});

// Změna role se projeví bez odhlášení (role se čtou per-request z DB).
test.describe("Změna role za běhu session", () => {
  test("nově přidělená role admin platí bez re-loginu", async ({ page }) => {
    const email = uniqueEmail("rolechange");
    await registerViaUi(page, email, "test-password-123");

    // Čerstvý účet nemá roli → 403.
    const before = await page.goto("/admin");
    expect(before?.status()).toBe(403);

    // Přidělíme roli admin přímo v DB (bez zásahu do session).
    await grantRoleByEmail(email, "admin");

    // Bez odhlášení/přihlášení musí být přístup ihned povolen.
    const after = await page.goto("/admin");
    expect(after?.status()).toBe(200);
    await expect(page.getByText("Admin", { exact: true })).toBeVisible();
  });
});
