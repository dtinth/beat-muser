/**
 * @packageDocumentation
 *
 * Virtual file system abstraction. Provides a unified {@link ProjectFileSystem}
 * interface over three backends: the browser's File System Access API (real
 * directories), an in-memory read-only file system for bundled example
 * projects, and an IndexedDB-backed store for browsers without File System
 * Access (see ADR 023). Backends are selected by `createProjectFileSystem` in
 * the project-store packlet, which owns the `ProjectSource` type.
 */

export { createFileSystemFromHandle } from "./real-fs.ts";
export { createFileSystemFromExample } from "./demo-fs.ts";
export {
  createFileSystemFromIndexedDb,
  deleteIndexedDbStore,
  FileNotFoundError,
  isFileNotFoundError,
} from "./indexeddb-fs.ts";
export { showDirectoryPicker } from "./picker.ts";
export { nextAvailableName } from "./naming.ts";
export type { ProjectFileSystem, FileEntry } from "./types.ts";
