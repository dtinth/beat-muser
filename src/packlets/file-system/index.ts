/**
 * @packageDocumentation
 *
 * Virtual file system abstraction. Provides a unified interface over the
 * browser's File System API (real directories) and an in-memory demo file
 * system for example projects.
 */

import type { ProjectSource } from "../project-store/types.ts";
import type { ProjectFileSystem, FileEntry } from "./types.ts";
import { createFileSystemFromHandle } from "./real-fs.ts";
import { createFileSystemFromExample } from "./demo-fs.ts";
import { showDirectoryPicker } from "./picker.ts";

export function createProjectFileSystem(source: ProjectSource): ProjectFileSystem {
  switch (source.provider) {
    case "filesystem":
      return createFileSystemFromHandle(source.handle);
    case "examples":
      return createFileSystemFromExample(source.name);
  }
}

export { showDirectoryPicker };
export type { ProjectFileSystem, FileEntry };
