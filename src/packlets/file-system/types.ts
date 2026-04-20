export interface FileEntry {
  name: string;
  path: string;
  size: number;
  lastModified: Date;
}

export interface ProjectFileSystem {
  listFiles(): Promise<FileEntry[]>;
  readFile(path: string): Promise<ArrayBuffer>;
  readText(path: string): Promise<string>;
}
