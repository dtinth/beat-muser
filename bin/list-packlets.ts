import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const PACKLETS_DIR = "src/packlets";

function extractSummary(source: string): string | undefined {
  // Grab the first /** ... */ block
  const block = source.match(/\/\*\*([\s\S]*?)\*\//u)?.[1];
  if (block === undefined || block === "") return undefined;

  // Strip leading ` * ` prefixes
  let text = block.replaceAll(/^\s*\*\s?/gmu, "").trim();

  // Strip initial @tags
  text = text.replace(/^(?:@[a-zA-Z]+\s*)+/u, "").trim();

  // First paragraph = text up to first markdown heading or double newline
  const paragraph = text.match(/^([\s\S]*?)(?=\n#+\s|\n\n|\r?\n@[a-zA-Z]|$)/u)?.[1];
  if (paragraph === undefined || paragraph === "") return undefined;

  return paragraph.replaceAll("\n", " ").trim();
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
  .filter((d: { isDirectory(): boolean }) => d.isDirectory())
  .map((d: { name: string }) => {
    const indexPath = findIndexPath(join(PACKLETS_DIR, d.name));
    let description: string | undefined;
    if (indexPath !== undefined) {
      description = extractSummary(readFileSync(indexPath, "utf-8"));
    }
    return { name: d.name, description };
  })
  .toSorted((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));

const maxName = Math.max(...entries.map((e: { name: string }) => e.name.length));

for (const { name, description } of entries) {
  const padded = name.padEnd(maxName);
  console.log(
    description !== undefined && description !== ""
      ? `${padded}  ${description}`
      : `${padded}  (no description)`,
  );
}
