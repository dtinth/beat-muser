export async function showDirectoryPicker(): Promise<FileSystemDirectoryHandle> {
  return (window as any).showDirectoryPicker();
}
