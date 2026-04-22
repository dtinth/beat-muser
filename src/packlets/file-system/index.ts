/**
 * @packageDocumentation
 *
 * Virtual file system abstraction. Provides a unified interface over the
 * browser's File System API (real directories) and an in-memory demo file
 * system for example projects.
 */

import type { ProjectSource } from "../project-store/types";
import type { ProjectFileSystem, FileEntry } from "./types";
import { createFileSystemFromHandle } from "./real-fs";
import { createFileSystemFromExample } from "./demo-fs";
import { showDirectoryPicker } from "./picker";

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
