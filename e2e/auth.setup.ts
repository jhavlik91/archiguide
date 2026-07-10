import { test as setup } from "@playwright/test";
import {
  ADMIN_STATE,
  DUAL_STATE,
  SEED_USERS,
  STORAGE_STATE,
  loginAndWait,
  registerViaUi,
  uniqueEmail,
} from "./auth-helpers";

/**
 * Setup projekt: založí sdíleného přihlášeného uživatele a uloží jeho session
 * do STORAGE_STATE. Testy layoutu ho pak jen načtou (bez opakovaného loginu).
 */
setup("vytvoř přihlášeného uživatele", async ({ page }) => {
  await registerViaUi(page, uniqueEmail("layout"), "test-password-123");
  await page.context().storageState({ path: STORAGE_STATE });
});

/**
 * Přihlásí seed uživatele s rolí admin a uloží jeho session (T004). Seed
 * uživatelé vznikají přes `prisma db seed`, které v CI běží před e2e.
 */
setup("přihlas seed admina", async ({ page }) => {
  await loginAndWait(page, SEED_USERS.admin.email, SEED_USERS.admin.password);
  await page.context().storageState({ path: ADMIN_STATE });
});

/** Přihlásí seed uživatele s rolemi client+professional a uloží session (T004). */
setup("přihlas seed dual-role uživatele", async ({ page }) => {
  await loginAndWait(page, SEED_USERS.dual.email, SEED_USERS.dual.password);
  await page.context().storageState({ path: DUAL_STATE });
});
