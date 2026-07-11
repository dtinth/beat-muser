// Ambient augmentations for the File System Access API. Parts of it are not yet
// in TypeScript's built-in DOM lib, so we declare the members the app relies on
// here (once, globally) instead of casting to `any` at each call site.

interface Window {
  showDirectoryPicker(): Promise<FileSystemDirectoryHandle>;
}

interface FileSystemDirectoryHandle {
  requestPermission(descriptor: { mode: "read" | "readwrite" }): Promise<PermissionState>;
}
