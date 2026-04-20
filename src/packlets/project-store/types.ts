export type ProjectSource =
  | { provider: "filesystem"; handle: FileSystemDirectoryHandle }
  | { provider: "examples"; name: string };

export interface Project {
  id: string;
  slug: string;
  displayName: string;
  source: ProjectSource;
  createdAt: string;
  lastOpenedAt: string;
  lastUpdatedAt: string;
}
