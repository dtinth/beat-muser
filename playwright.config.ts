import { defineConfig } from "@playwright/test";

const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./tests",
  // Exclude the perf spec from the regular CI suite; run it via playwright.perf.config.ts.
  testIgnore: "perf.spec.ts",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
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
