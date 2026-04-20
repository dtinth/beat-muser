import type { FileEntry, ProjectFileSystem } from "./types";

const demoModules = import.meta.glob("/examples/**/*", {
  query: "?raw",
  import: "default",
  eager: true,
});

const demoFiles = new Map<string, string>();

for (const [path, content] of Object.entries(demoModules)) {
  const relativePath = path.replace("/examples/", "");
  if (typeof content === "string") {
    demoFiles.set(relativePath, content);
  }
}

export function createFileSystemFromExample(name: string): ProjectFileSystem {
  const prefix = `${name}/`;

  function getEntries(): FileEntry[] {
    const entries: FileEntry[] = [];
    for (const [path] of demoFiles) {
      if (path.startsWith(prefix)) {
        const name = path.replace(prefix, "");
        const content = demoFiles.get(path) ?? "";
        entries.push({
          name,
          path,
          size: new TextEncoder().encode(content).length,
          lastModified: new Date(),
        });
      }
    }
    return entries;
  }

  return {
    async listFiles() {
      return getEntries();
    },
    async readFile(path: string) {
      const content = demoFiles.get(path);
      if (content === undefined) {
        throw new Error(`File not found: ${path}`);
      }
      return new TextEncoder().encode(content).buffer;
    },
    async readText(path: string) {
      const content = demoFiles.get(path);
      if (content === undefined) {
        throw new Error(`File not found: ${path}`);
      }
      return content;
    },
  };
}
