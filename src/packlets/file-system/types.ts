export interface FileEntry {
  name: string;
  path: string;
  size: number;
  lastModified: Date;
}

export interface ProjectFileSystem {
  /** Whether write operations (`writeFile`, `deleteFile`) are rejected. */
  readonly readOnly: boolean;
  listFiles(): Promise<FileEntry[]>;
  readFile(path: string): Promise<ArrayBuffer>;
  readText(path: string): Promise<string>;
  writeFile(path: string, content: string | ArrayBuffer): Promise<void>;
  deleteFile(path: string): Promise<void>;
}
