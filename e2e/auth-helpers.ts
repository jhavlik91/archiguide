import { expect, type Page } from "@playwright/test";

/** Uložený přihlášený stav sdíleného uživatele (viz auth.setup.ts). */
export const STORAGE_STATE = "e2e/.auth/user.json";
/** Session seed uživatele s rolí admin (viz auth.setup.ts, T004). */
export const ADMIN_STATE = "e2e/.auth/admin.json";
/** Session seed uživatele s rolemi client+professional (T004). */
export const DUAL_STATE = "e2e/.auth/dual.json";

/**
 * Seed uživatelé zakládaní `prisma db seed` (T004). Heslo je společné dev heslo.
 * Používají je role/permission e2e testy.
 */
export const SEED_USERS = {
  admin: { email: "admin@archiguide.test", password: "dev-password-123" },
  dual: { email: "dual@archiguide.test", password: "dev-password-123" },
} as const;

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
  // Radix checkbox reaguje až po hydrataci Reactu — klik před ní se ztratí a
  // server pak registraci odmítne (nesouhlas s podmínkami). Klikáme proto,
  // dokud není checkbox skutečně zaškrtnutý; tím je zaručeno i to, že následný
  // submit odchází až po hydrataci.
  const terms = page.getByRole("checkbox");
  await expect(async () => {
    if (!(await terms.isChecked())) await terms.click();
    await expect(terms).toBeChecked({ timeout: 1_000 });
  }).toPass();
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

/** Přihlásí existujícího uživatele a počká na přesměrování do aplikace. */
export async function loginAndWait(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await loginViaUi(page, email, password);
  await page.waitForURL("**/dashboard");
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

/** Odkaz z posledního e-mailu (verifikace i reset sdílí stejný dev outbox). */
export const fetchEmailLink = fetchResetLink;

/** Přečte poslední ověřovací SMS kód pro číslo z dev SMS outboxu (T011). */
export async function fetchSmsCode(page: Page, phone: string): Promise<string> {
  const res = await page.request.get(
    `/api/dev/sms?to=${encodeURIComponent(phone)}`,
  );
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { code?: string };
  expect(body.code, "SMS outbox obsahuje kód").toBeTruthy();
  return body.code as string;
}
