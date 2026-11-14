import { defineConfig, devices } from "@playwright/test";

import { E2E_ENV, E2E_PORT } from "./e2e/env";

/**
 * Browser tests. They start the app on its own port against a throw-away
 * embedded database seeded with made-up customers, so they need no secrets,
 * no bank data and no network, and they never touch a real database.
 *
 *   pnpm e2e
 */
export default defineConfig({
  testDir: "e2e",
  // Generous: the first visit to each screen is compiled on demand.
  timeout: 90_000,
  expect: { timeout: 25_000 },
  // The embedded database is one file store: run the tests one after another.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "phone",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        // Locally the installed Chrome is used; CI installs Chromium.
        channel: process.env.CI ? undefined : "chrome",
      },
    },
  ],
  webServer: {
    command: `pnpm exec tsx scripts/seed-e2e.ts && pnpm exec next dev -p ${E2E_PORT}`,
    url: `http://localhost:${E2E_PORT}/api/health`,
    timeout: 180_000,
    reuseExistingServer: false,
    env: E2E_ENV,
  },
});
