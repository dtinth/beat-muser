import { defineConfig } from "@playwright/test";

/**
 * Playwright config for the performance profiler spec.
 *
 * Run with: pnpm perf
 * (or: pnpm exec playwright test --config playwright.perf.config.ts)
 *
 * Requires the dev server to be running on port 15036.
 * Start it with: vp dev
 */
export default defineConfig({
  testDir: "./tests",
  testMatch: "perf.spec.ts",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:15036",
    trace: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
