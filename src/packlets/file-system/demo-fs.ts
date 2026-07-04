import type { FileEntry, ProjectFileSystem } from "./types.ts";
import { FileNotFoundError } from "./indexeddb-fs.ts";

// Text assets (project file, notes) are inlined as strings. Binary assets
// (audio, images) are exposed as URLs and fetched on demand so they survive
// the round trip intact — reading them as raw text would corrupt the bytes.
const textModules = import.meta.glob("/examples/**/*.{json,txt,md}", {
  query: "?raw",
  import: "default",
  eager: true,
});
const urlModules = import.meta.glob("/examples/**/*.{ogg,wav,mp3,flac,png,jpg,jpeg,gif,svg}", {
  query: "?url",
  import: "default",
  eager: true,
});

interface DemoAsset {
  /** Path relative to the example directory, e.g. "audio/kick.ogg". */
  relativePath: string;
  text?: string;
  url?: string;
}

/** Map of example name -> (relative path -> asset). */
const examples = new Map<string, Map<string, DemoAsset>>();

function register(fullPath: string, asset: Partial<DemoAsset>): void {
  const match = fullPath.match(/^\/examples\/([^/]+)\/(.+)$/);
  if (!match) return;
  const [, exampleName, relativePath] = match;
  let files = examples.get(exampleName);
  if (!files) {
    files = new Map();
    examples.set(exampleName, files);
  }
  files.set(relativePath, { ...files.get(relativePath), relativePath, ...asset });
}

for (const [path, content] of Object.entries(textModules)) {
  if (typeof content === "string") register(path, { text: content });
}
for (const [path, url] of Object.entries(urlModules)) {
  if (typeof url === "string") register(path, { url });
}

export function createFileSystemFromExample(name: string): ProjectFileSystem {
  const files = examples.get(name) ?? new Map<string, DemoAsset>();

  async function readArrayBuffer(path: string): Promise<ArrayBuffer> {
    const asset = files.get(path);
    if (!asset) throw new FileNotFoundError(path);
    if (asset.url !== undefined) {
      const response = await fetch(asset.url);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${path}: ${response.status}`);
      }
      return response.arrayBuffer();
    }
    return new TextEncoder().encode(asset.text ?? "").buffer;
  }

  return {
    readOnly: true,
    async listFiles(): Promise<FileEntry[]> {
      const entries: FileEntry[] = [];
      for (const asset of files.values()) {
        entries.push({
          name: asset.relativePath,
          path: asset.relativePath,
          size: asset.text !== undefined ? new TextEncoder().encode(asset.text).length : 0,
          lastModified: new Date(),
        });
      }
      return entries;
    },
    readFile(path: string) {
      return readArrayBuffer(path);
    },
    async readText(path: string) {
      const asset = files.get(path);
      if (asset?.text !== undefined) return asset.text;
      const buffer = await readArrayBuffer(path);
      return new TextDecoder().decode(buffer);
    },
    async writeFile() {
      throw new Error("Demo file system is read-only");
    },
    async deleteFile() {
      throw new Error("Demo file system is read-only");
    },
  };
}
