import type { FileEntry, ProjectFileSystem } from "./types";

export function createFileSystemFromHandle(handle: FileSystemDirectoryHandle): ProjectFileSystem {
  async function getEntries(dir: FileSystemDirectoryHandle, prefix = ""): Promise<FileEntry[]> {
    const entries: FileEntry[] = [];
    for await (const entry of dir.values()) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.kind === "file") {
        const file = await entry.getFile();
        entries.push({
          name: entry.name,
          path,
          size: file.size,
          lastModified: new Date(file.lastModified),
        });
      } else if (entry.kind === "directory") {
        entries.push(...(await getEntries(entry, path)));
      }
    }
    return entries;
  }

  async function getFileHandle(path: string): Promise<FileSystemFileHandle> {
    const parts = path.split("/");
    let dir = handle;
    for (let i = 0; i < parts.length - 1; i++) {
      dir = await dir.getDirectoryHandle(parts[i]);
    }
    return dir.getFileHandle(parts[parts.length - 1]);
  }

  return {
    async listFiles() {
      return getEntries(handle);
    },
    async readFile(path: string) {
      const fileHandle = await getFileHandle(path);
      const file = await fileHandle.getFile();
      return file.arrayBuffer();
    },
    async readText(path: string) {
      const buffer = await this.readFile(path);
      return new TextDecoder().decode(buffer);
    },
  };
}
