import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { makeBadge } from "badge-maker";

const OUTPUT_DIR = process.argv[2] || "ci-reports";

function colorForTestRate(passed: number, total: number): string {
  const rate = total === 0 ? 0 : passed / total;
  if (rate === 1) return "brightgreen";
  if (rate >= 0.9) return "green";
  if (rate >= 0.7) return "yellow";
  return "red";
}

function colorForCoverage(pct: number): string {
  if (pct >= 90) return "brightgreen";
  if (pct >= 80) return "green";
  if (pct >= 60) return "yellow";
  if (pct >= 40) return "orange";
  return "red";
}

// --- Tests badge (from Allure summary.json) ---
function generateTestsBadge() {
  const summaryPath = join(OUTPUT_DIR, "allure", "summary.json");
  let passed = 0;
  let total = 0;
  try {
    const summary = JSON.parse(readFileSync(summaryPath, "utf-8"));
    passed = summary.stats?.passed ?? 0;
    total = summary.stats?.total ?? 0;
  } catch {
    // fallback: count allure-results files
  }
  const label = total === 0 ? "tests" : `${passed}/${total} tests`;
  const color = colorForTestRate(passed, total);
  const svg = makeBadge({
    label: "tests",
    message: label,
    color,
  });
  writeFileSync(join(OUTPUT_DIR, "badge-tests.svg"), svg);
  console.log(`badge-tests.svg: ${label} (${color})`);
}

// --- Playwright badge (from allure-results-playwright) ---
function generatePlaywrightBadge() {
  const resultsDir = join(OUTPUT_DIR, "allure-results-playwright");
  let passed = 0;
  let total = 0;
  try {
    const files = readdirSync(resultsDir);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const data = JSON.parse(readFileSync(join(resultsDir, file), "utf-8"));
      if (data.status === "passed") passed++;
      if (["passed", "failed", "broken", "skipped"].includes(data.status)) total++;
    }
  } catch {
    // no results
  }
  const label = total === 0 ? "e2e" : `${passed}/${total} e2e`;
  const color = colorForTestRate(passed, total);
  const svg = makeBadge({
    label: "playwright",
    message: label,
    color,
  });
  writeFileSync(join(OUTPUT_DIR, "badge-playwright.svg"), svg);
  console.log(`badge-playwright.svg: ${label} (${color})`);
}

// --- Packlets badge ---
function generatePackletsBadge() {
  const packletsDir = "src/packlets";
  let count = 0;
  try {
    count = readdirSync(packletsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).length;
  } catch {
    // no packlets dir
  }
  const svg = makeBadge({
    label: "packlets",
    message: String(count),
    color: "blue",
  });
  writeFileSync(join(OUTPUT_DIR, "badge-packlets.svg"), svg);
  console.log(`badge-packlets.svg: ${count} (blue)`);
}

// --- Coverage badge (from coverage-summary.json) ---
function generateCoverageBadge() {
  const summaryPath = join(OUTPUT_DIR, "coverage", "coverage-summary.json");
  let pct = 0;
  try {
    const summary = JSON.parse(readFileSync(summaryPath, "utf-8"));
    pct = summary.total?.lines?.pct ?? 0;
  } catch {
    // no coverage
  }
  const message = `${Math.round(pct)}%`;
  const color = colorForCoverage(pct);
  const svg = makeBadge({
    label: "coverage",
    message,
    color,
  });
  writeFileSync(join(OUTPUT_DIR, "badge-coverage.svg"), svg);
  console.log(`badge-coverage.svg: ${message} (${color})`);
}

generateTestsBadge();
generatePlaywrightBadge();
generatePackletsBadge();
generateCoverageBadge();
