import { expect, test, type Page } from "@playwright/test";
import { ADMIN_STATE, STORAGE_STATE } from "./auth-helpers";

const MOBILE = { width: 360, height: 740 };
const DESKTOP = { width: 1280, height: 800 };

async function goto(page: Page, path: string) {
  await page.goto(path);
}

test.describe("Public layout", () => {
  test("desktop shows inline navigation and login CTA", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await goto(page, "/");

    await expect(
      page.getByRole("navigation", { name: "Hlavní navigace" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Otevřít menu" }),
    ).toBeHidden();
  });

  test("mobile collapses navigation behind a toggle", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await goto(page, "/");

    await expect(
      page.getByRole("navigation", { name: "Hlavní navigace" }),
    ).toBeHidden();

    const toggle = page.getByRole("button", { name: "Otevřít menu" });
    await expect(toggle).toBeVisible();
    await toggle.click();

    await expect(
      page.getByRole("navigation", { name: "Hlavní navigace (mobil)" }),
    ).toBeVisible();
  });
});

test.describe("App layout", () => {
  // Přihlášené sekce vyžadují session (T003 middleware).
  test.use({ storageState: STORAGE_STATE });

  test("desktop shows the persistent sidebar", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await goto(page, "/dashboard");

    await expect(
      page.getByRole("navigation", { name: "Navigace aplikace" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Přehled" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(
      page.getByRole("button", { name: "Otevřít navigaci" }),
    ).toBeHidden();
  });

  test("mobile opens the sidebar as a drawer", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await goto(page, "/dashboard");

    const toggle = page.getByRole("button", { name: "Otevřít navigaci" });
    await expect(toggle).toBeVisible();
    await toggle.click();

    const drawer = page.getByRole("dialog", { name: "Navigace" });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("link", { name: "Přehled" })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
  });
});

test.describe("Admin layout", () => {
  // (admin) je chráněná rolí (T004) — potřebuje admin session.
  test.use({ storageState: ADMIN_STATE });

  test("renders the admin shell on desktop", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await goto(page, "/admin");

    await expect(page.getByText("Admin", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Navigace aplikace" }),
    ).toBeVisible();
  });

  test("renders the admin shell on mobile", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await goto(page, "/admin");

    const toggle = page.getByRole("button", { name: "Otevřít navigaci" });
    await expect(toggle).toBeVisible();
    await toggle.click();

    await expect(page.getByRole("dialog", { name: "Navigace" })).toBeVisible();
  });
});
