/**
 * IndexedDB-backed implementation of the {@link ProjectFileSystem}. Stores
 * file contents as blobs in a dedicated object store, keyed by `[storeId,
 * path]`, so a project can keep its assets in the browser on platforms that
 * lack the File System Access API (notably iPad Safari). IndexedDB is a
 * secondary store accepted only out of necessity — see ADR 023.
 */

import { openDB, type IDBPDatabase } from "idb";
import type { FileEntry, ProjectFileSystem } from "./types.ts";

const DB_NAME = "beat-muser-files";
const STORE = "files";

interface FileRow {
  storeId: string;
  path: string;
  name: string;
  size: number;
  lastModified: number;
  blob: Blob;
}

let dbPromise: Promise<IDBPDatabase> | undefined;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore(STORE, { keyPath: ["storeId", "path"] });
      },
    });
  }
  return dbPromise;
}

/** Range covering every row whose key starts with `[storeId]`. */
function storeRange(storeId: string): IDBKeyRange {
  // An array sorts after any string in IndexedDB key ordering, so `[storeId, []]`
  // is greater than every `[storeId, <pathString>]`.
  return IDBKeyRange.bound([storeId], [storeId, []]);
}

export function createFileSystemFromIndexedDb(storeId: string): ProjectFileSystem {
  return {
    readOnly: false,

    async listFiles() {
      const db = await getDb();
      const rows = (await db.getAll(STORE, storeRange(storeId))) as FileRow[];
      return rows.map(
        (row): FileEntry => ({
          name: row.name,
          path: row.path,
          size: row.size,
          lastModified: new Date(row.lastModified),
        }),
      );
    },

    async readFile(path: string) {
      const db = await getDb();
      const row = (await db.get(STORE, [storeId, path])) as FileRow | undefined;
      if (!row) {
        throw new FileNotFoundError(path);
      }
      return row.blob.arrayBuffer();
    },

    async readText(path: string) {
      const buffer = await this.readFile(path);
      return new TextDecoder().decode(buffer);
    },

    async writeFile(path: string, content: string | ArrayBuffer) {
      const db = await getDb();
      const blob = new Blob([content]);
      const row: FileRow = {
        storeId,
        path,
        name: path.split("/").pop() ?? path,
        size: blob.size,
        lastModified: Date.now(),
        blob,
      };
      await db.put(STORE, row);
    },

    async deleteFile(path: string) {
      const db = await getDb();
      await db.delete(STORE, [storeId, path]);
    },
  };
}

/** Removes every file belonging to `storeId`. Used when a project is deleted. */
export async function deleteIndexedDbStore(storeId: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE, storeRange(storeId));
}

export class FileNotFoundError extends Error {
  constructor(path: string) {
    super(`File not found: ${path}`);
    this.name = "FileNotFoundError";
  }
}

/**
 * Whether an error means "this file does not exist", across file system
 * backends: real-fs raises a `DOMException` named `NotFoundError`, while
 * indexeddb-fs raises a {@link FileNotFoundError}.
 */
export function isFileNotFoundError(error: unknown): boolean {
  if (error instanceof FileNotFoundError) return true;
  return error instanceof DOMException && error.name === "NotFoundError";
}
