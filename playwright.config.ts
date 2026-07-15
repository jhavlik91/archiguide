import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT) || 3000;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // CI jede proti `next dev` na 2jádrovém runneru — první hit každé routy
  // platí kompilaci, takže dlouhé multi-step testy (professional-search,
  // brief-share, organizations) občas přelezly výchozích 30 s / 5 s a sada
  // nedeterministicky padala. Delší limity nic nezpomalují (čeká se jen na
  // reálné selhání), jen ohraničují nejhorší případ.
  timeout: process.env.CI ? 60_000 : 30_000,
  expect: { timeout: process.env.CI ? 10_000 : 5_000 },
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    // Založí sdíleného přihlášeného uživatele a uloží storageState.
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // E2e sada dělá desítky registrací/loginů z jedné IP — produkční limit
    // 5/min/IP by ji nedeterministicky shazoval (viz src/lib/rate-limit.ts).
    // Pozor: `reuseExistingServer` — ručně spuštěný dev server pro e2e musí
    // proměnnou dostat taky (`RATE_LIMIT_DISABLED=1 npm run dev`).
    env: { RATE_LIMIT_DISABLED: "1" },
  },
});
