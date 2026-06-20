import type { FileEntry, ProjectFileSystem } from "./types.ts";

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

  async function getFileHandle(
    path: string,
    options?: FileSystemGetFileOptions,
  ): Promise<FileSystemFileHandle> {
    const parts = path.split("/");
    let dir = handle;
    for (let i = 0; i < parts.length - 1; i++) {
      dir = await dir.getDirectoryHandle(parts[i], { create: true });
    }
    return dir.getFileHandle(parts[parts.length - 1], options);
  }

  return {
    readOnly: false,
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
    async writeFile(path: string, content: string | ArrayBuffer) {
      const fileHandle = await getFileHandle(path, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();
    },
    async deleteFile(path: string) {
      const parts = path.split("/");
      let dir = handle;
      for (let i = 0; i < parts.length - 1; i++) {
        dir = await dir.getDirectoryHandle(parts[i]);
      }
      await dir.removeEntry(parts[parts.length - 1]);
    },
  };
}
