declare global {
  interface Window {
    showDirectoryPicker(): Promise<FileSystemDirectoryHandle>;
  }
}

export function showDirectoryPicker(): Promise<FileSystemDirectoryHandle> {
  return window.showDirectoryPicker();
}
