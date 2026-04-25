import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PACKLETS_DIR = "src/packlets";
const OUTPUT_DIR = process.argv[2] || "ci-reports";

function extractSummary(source: string): string | undefined {
  const block = source.match(/\/\*\*([\s\S]*?)\*\//)?.[1];
  if (!block) return undefined;
  let text = block.replace(/^\s*\*\s?/gm, "").trim();
  text = text.replace(/^(?:@[a-zA-Z]+\s*)+/, "").trim();
  const paragraph = text.match(/^([\s\S]*?)(?=\n#+\s|\n\n|@[a-zA-Z]|$)/)?.[1];
  if (!paragraph) return undefined;
  return paragraph.replace(/\n/g, " ").trim();
}

function findIndexPath(dir: string): string | undefined {
  for (const ext of ["ts", "tsx"]) {
    const p = join(dir, `index.${ext}`);
    try {
      readFileSync(p);
      return p;
    } catch {
      // try next extension
    }
  }
  return undefined;
}

const entries = readdirSync(PACKLETS_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => {
    const indexPath = findIndexPath(join(PACKLETS_DIR, d.name));
    let description: string | undefined;
    if (indexPath) {
      description = extractSummary(readFileSync(indexPath, "utf-8"));
    }
    return { name: d.name, description, indexPath };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

const repo = process.env.GITHUB_REPOSITORY || "dtinth/beat-muser";
const serverUrl = process.env.GITHUB_SERVER_URL || "https://github.com";
const runId = process.env.GITHUB_RUN_ID;
const sha = process.env.GITHUB_SHA;
const branch = process.env.GITHUB_REF_NAME || "main";

const buildUrl = runId ? `${serverUrl}/${repo}/actions/runs/${runId}` : undefined;
const commitUrl = sha ? `${serverUrl}/${repo}/commit/${sha}` : undefined;
const shortSha = sha ? sha.slice(0, 7) : "unknown";

function sourceLink(_packletName: string, indexPath?: string): string {
  if (!indexPath) return "#";
  return `${serverUrl}/${repo}/blob/${branch}/${indexPath}`;
}

const html = `<!DOCTYPE html>
<html lang="en" data-color-mode="dark" data-dark-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Beat Muser CI Reports</title>
  <link rel="stylesheet" href="https://unpkg.com/@primer/css@^21.0.0/dist/primer.css">
  <style>
    body { background-color: var(--bgColor-default); min-height: 100vh; }
    .report-card { transition: border-color 0.2s; }
    .report-card:hover { border-color: var(--borderColor-accent-emphasis); }
  </style>
</head>
<body>
  <div class="container-lg py-6 px-3">
    <div class="d-flex flex-items-center flex-justify-between mb-4">
      <h1 class="f1 text-normal">Beat Muser CI Reports</h1>
      <span class="Label Label--accent">main</span>
    </div>

    <div class="Box Box--condensed mb-4">
      <div class="Box-header">
        <h2 class="Box-title f4">Build Info</h2>
      </div>
      <div class="Box-body">
        <div class="d-flex flex-wrap gap-4">
          ${buildUrl ? `<div><span class="text-bold">CI Run:</span> <a href="${buildUrl}" target="_blank" rel="noopener">#${runId}</a></div>` : ""}
          ${sha ? `<div><span class="text-bold">Commit:</span> <a href="${commitUrl}" target="_blank" rel="noopener">${shortSha}</a></div>` : ""}
          <div><span class="text-bold">Branch:</span> ${branch}</div>
        </div>
      </div>
    </div>

    <div class="d-flex flex-wrap gap-3 mb-6">
      <a href="./allure/index.html" class="report-card d-flex flex-items-center p-3 border rounded-2 color-fg-default no-underline width-full" style="max-width: 280px;">
        <div class="flex-auto">
          <div class="f4 text-bold mb-1">Allure Report</div>
          <div class="color-fg-muted f6">Unified test results (Vitest + Playwright)</div>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="color-fg-muted"><path d="m9 18 6-6-6-6"/></svg>
      </a>
      <a href="./playwright/index.html" class="report-card d-flex flex-items-center p-3 border rounded-2 color-fg-default no-underline width-full" style="max-width: 280px;">
        <div class="flex-auto">
          <div class="f4 text-bold mb-1">Playwright Report</div>
          <div class="color-fg-muted f6">E2E test results</div>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="color-fg-muted"><path d="m9 18 6-6-6-6"/></svg>
      </a>
    </div>

    <div class="Box">
      <div class="Box-header d-flex flex-items-center flex-justify-between">
        <h2 class="Box-title f4">Packlets</h2>
        <span class="Counter">${entries.length}</span>
      </div>
      <ul>
        ${entries
          .map(
            (e) => `
        <li class="Box-row Box-row--hover-gray d-flex flex-items-center flex-justify-between">
          <div class="flex-auto">
            <a href="${sourceLink(e.name, e.indexPath)}" class="f5 text-bold Link--primary" target="_blank" rel="noopener">${e.name}</a>
            <div class="color-fg-muted f6 mt-1">${e.description || "(no description)"}</div>
          </div>
          <a href="${sourceLink(e.name, e.indexPath)}" class="btn btn-sm" target="_blank" rel="noopener">View source</a>
        </li>`,
          )
          .join("")}
      </ul>
    </div>
  </div>
</body>
</html>
`;

writeFileSync(join(OUTPUT_DIR, "index.html"), html);
console.log(`Report index written to ${join(OUTPUT_DIR, "index.html")}`);
