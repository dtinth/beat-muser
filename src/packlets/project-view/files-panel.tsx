/**
 * Project Files panel — the "Files" tab of the Sounds panel. Lists the
 * project file system's entries and, when the file system is writable, allows
 * uploading, downloading, and deleting assets. See ADR 023.
 *
 * Known limitation: uploading or replacing a file does not re-decode it in the
 * audio engine; a page reload is required to pick up new bytes.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Flex, IconButton, Text } from "@radix-ui/themes";
import { Download, RefreshCw, Trash2, Upload } from "lucide-react";
import type { ProjectFileSystem, FileEntry } from "../file-system/index.ts";
import { nextAvailableName } from "../file-system/index.ts";
import type { ModalManager } from "../modal-manager/index.ts";
import { useToast } from "../toast/index.tsx";

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function FilesPanel({
  fileSystem,
  modalManager,
}: {
  fileSystem: ProjectFileSystem;
  modalManager: ModalManager;
}) {
  const { showError, showSuccess } = useToast();
  const [files, setFiles] = useState<FileEntry[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const entries = await fileSystem.listFiles();
      entries.sort((a, b) => a.path.localeCompare(b.path));
      setFiles(entries);
    } catch (error) {
      console.error(error);
      showError({ title: "Failed to list files", description: (error as Error).message });
    }
  }, [fileSystem, showError]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleUpload = useCallback(
    async (fileList: FileList) => {
      const taken = new Set((await fileSystem.listFiles()).map((f) => f.path));
      let uploaded = 0;
      for (const file of Array.from(fileList)) {
        let path = file.name;
        if (taken.has(path)) {
          const choice = await modalManager.select({
            title: `"${file.name}" already exists`,
            items: [
              { id: "overwrite", label: "Overwrite", value: "overwrite" },
              { id: "keep", label: "Keep both", value: "keep" },
              { id: "skip", label: "Skip", value: "skip" },
            ],
          });
          if (!choice || choice.value === "skip") continue;
          if (choice.value === "keep") path = nextAvailableName(taken, file.name);
        }
        try {
          await fileSystem.writeFile(path, await file.arrayBuffer());
          taken.add(path);
          uploaded++;
        } catch (error) {
          console.error(error);
          showError({
            title: `Failed to upload ${file.name}`,
            description: (error as Error).message,
          });
        }
      }
      if (uploaded > 0) {
        showSuccess({ title: `Uploaded ${uploaded} file${uploaded === 1 ? "" : "s"}` });
        await refresh();
      }
    },
    [fileSystem, modalManager, refresh, showError, showSuccess],
  );

  const handleDownload = useCallback(
    async (entry: FileEntry) => {
      try {
        const buffer = await fileSystem.readFile(entry.path);
        const url = URL.createObjectURL(new Blob([buffer]));
        const a = document.createElement("a");
        a.href = url;
        a.download = entry.name;
        a.click();
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error(error);
        showError({
          title: `Failed to download ${entry.name}`,
          description: (error as Error).message,
        });
      }
    },
    [fileSystem, showError],
  );

  const handleDelete = useCallback(
    async (entry: FileEntry) => {
      const choice = await modalManager.select({
        title: `Delete "${entry.path}"?`,
        items: [{ id: "delete", label: "Delete", value: "delete" }],
        placeholder: "This cannot be undone",
      });
      if (!choice) return;
      try {
        await fileSystem.deleteFile(entry.path);
        await refresh();
      } catch (error) {
        console.error(error);
        showError({
          title: `Failed to delete ${entry.name}`,
          description: (error as Error).message,
        });
      }
    },
    [fileSystem, modalManager, refresh, showError],
  );

  return (
    <Flex direction="column" style={{ gap: 8 }}>
      <Flex justify="between" align="center">
        {!fileSystem.readOnly ? (
          <Button size="1" variant="soft" onClick={() => inputRef.current?.click()}>
            <Upload size={14} /> Upload
          </Button>
        ) : (
          <Text size="1" color="gray">
            Read-only
          </Text>
        )}
        <IconButton size="1" variant="ghost" title="Refresh" onClick={() => void refresh()}>
          <RefreshCw size={14} />
        </IconButton>
      </Flex>

      <input
        ref={inputRef}
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          const fileList = e.target.files;
          if (fileList && fileList.length > 0) void handleUpload(fileList);
          e.target.value = "";
        }}
      />

      {files.length === 0 ? (
        <Text size="1" color="gray">
          No files yet.
        </Text>
      ) : (
        <Flex direction="column" style={{ gap: 2 }}>
          {files.map((entry) => (
            <Flex
              key={entry.path}
              justify="between"
              align="center"
              style={{ padding: "2px 4px", borderRadius: 4, gap: 4 }}
            >
              <Flex direction="column" style={{ minWidth: 0 }}>
                <Text size="1" truncate title={entry.path}>
                  {entry.path}
                </Text>
                <Text size="1" color="gray">
                  {formatBytes(entry.size)}
                </Text>
              </Flex>
              <Flex align="center" style={{ gap: 2, flexShrink: 0 }}>
                <IconButton
                  size="1"
                  variant="ghost"
                  title="Download"
                  onClick={() => void handleDownload(entry)}
                >
                  <Download size={12} />
                </IconButton>
                {!fileSystem.readOnly && (
                  <IconButton
                    size="1"
                    variant="ghost"
                    color="red"
                    title="Delete"
                    onClick={() => void handleDelete(entry)}
                  >
                    <Trash2 size={12} />
                  </IconButton>
                )}
              </Flex>
            </Flex>
          ))}
        </Flex>
      )}
    </Flex>
  );
}
