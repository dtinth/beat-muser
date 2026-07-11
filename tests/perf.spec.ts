import { test } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Performance profiler spec (@perf).
 *
 * Navigates to the demo project, waits for audio to decode, runs ~100 rAF
 * frames of profiling while sweeping through the densest note region, then
 * writes the plain-text report to perf-reports/latest.txt.
 *
 * Run with: pnpm perf
 * NOT included in the regular CI test suite (excluded via playwright.config.ts testIgnore).
 */
test("@perf: render performance profile on demo chart", async ({ page }) => {
  // Navigate to the demo project and wait for the app to finish loading.
  await page.goto("/projects/__demo__");
  await page.waitForLoadState("networkidle");

  // Wait for all audio files to be decoded (or settle) so waveform rendering
  // is stable during the profile run.
  await page.evaluate(async () => {
    await window.__beatMuserAudioReady?.();
  });

  // Run the profiler (100 rAF frames, 10 warmup).
  const report = await page.evaluate(() => {
    const fn = window.__beatMuserProfilePerformance;
    // oxlint-disable-next-line vitest/no-conditional-in-test -- runs in the browser via page.evaluate; guards presence of the injected global
    if (!fn) throw new Error("window.__beatMuserProfilePerformance not found");
    return fn();
  });

  // Print the report to test output so it appears in the Playwright log.
  console.log(report);

  // Save to perf-reports/latest.txt (relative to project root).
  const reportsDir = path.join(import.meta.dirname, "..", "perf-reports");
  fs.mkdirSync(reportsDir, { recursive: true });
  fs.writeFileSync(path.join(reportsDir, "latest.txt"), report, "utf-8");
});
