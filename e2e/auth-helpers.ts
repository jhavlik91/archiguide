import { expect, type Page } from "@playwright/test";

/** Uložený přihlášený stav sdíleného uživatele (viz auth.setup.ts). */
export const STORAGE_STATE = "e2e/.auth/user.json";

/** Vygeneruje unikátní e-mail, aby testy nekolidovaly na unique indexu. */
export function uniqueEmail(prefix = "user"): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

/** Registrace přes UI; po úspěchu je uživatel přihlášen a na /dashboard. */
export async function registerViaUi(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto("/register");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Heslo").fill(password);
  await page.getByRole("checkbox").click();
  await page.getByRole("button", { name: "Vytvořit účet" }).click();
  await page.waitForURL("**/dashboard");
}

/** Přihlášení přes UI existujícího uživatele. */
export async function loginViaUi(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Heslo").fill(password);
  await page.getByRole("button", { name: "Přihlásit se" }).click();
}

/** Přečte poslední dev e-mail pro adresu z in-memory outboxu. */
export async function fetchResetLink(
  page: Page,
  email: string,
): Promise<string> {
  const res = await page.request.get(
    `/api/dev/outbox?to=${encodeURIComponent(email)}`,
  );
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { link?: string };
  expect(body.link, "outbox e-mail obsahuje odkaz").toBeTruthy();
  return body.link as string;
}
