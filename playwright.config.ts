import { defineConfig, devices } from "@playwright/test";

/**
 * Konfiguracja testów E2E.
 * Testy uruchamiają się przeciwko działającemu serwerowi dev (localhost:3000)
 * i sprzątają po sobie utworzone dane (strategia self-cleaning na dev DB).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "line" : [["list"], ["html", { open: "never" }]],
  timeout: 30_000,
  expect: { timeout: 7_000 },
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    locale: "pl-PL",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/documents",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
