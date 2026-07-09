import { test as setup } from "@playwright/test";
import { STORAGE_STATE, registerViaUi, uniqueEmail } from "./auth-helpers";

/**
 * Setup projekt: založí sdíleného přihlášeného uživatele a uloží jeho session
 * do STORAGE_STATE. Testy layoutu ho pak jen načtou (bez opakovaného loginu).
 */
setup("vytvoř přihlášeného uživatele", async ({ page }) => {
  await registerViaUi(page, uniqueEmail("layout"), "test-password-123");
  await page.context().storageState({ path: STORAGE_STATE });
});
