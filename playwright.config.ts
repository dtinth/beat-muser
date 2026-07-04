import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  // Exclude the perf spec from the regular CI suite; run it via playwright.perf.config.ts.
  testIgnore: "perf.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["html", { outputFolder: "ci-reports/playwright" }],
    ["allure-playwright", { resultsDir: "ci-reports/allure-results-playwright" }],
  ],
  use: {
    baseURL: "http://localhost:15036",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
