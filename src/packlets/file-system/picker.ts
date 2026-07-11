export function showDirectoryPicker(): Promise<FileSystemDirectoryHandle> {
  return window.showDirectoryPicker();
}
