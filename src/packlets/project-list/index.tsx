/**
 * @packageDocumentation
 *
 * Home page listing saved projects. Supports creating a new IndexedDB-backed
 * project, opening a folder via the File System API, connecting a WebDAV
 * server, creating a demo project, and removing projects from the local index.
 */

import { useCallback, useState } from "react";
import { useNavigate, useLoaderData, useRevalidator } from "react-router";
import {
  Box,
  Button,
  Card,
  Flex,
  Heading,
  Text,
  TextField,
  DropdownMenu,
  IconButton,
  Dialog,
} from "@radix-ui/themes";
import { uuidv7 } from "uuidv7";
import { addProject, removeProject } from "../project-store/index.ts";
import { showDirectoryPicker } from "../file-system/index.ts";
import { useToast } from "../toast/index.tsx";
import type { Project } from "../project-store/types.ts";

function isFileSystemAccessSupported(): boolean {
  return typeof Reflect.get(window, "showDirectoryPicker") === "function";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function ProjectListPage() {
  const projects = useLoaderData<Project[]>();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const { showError } = useToast();
  const [demoOpen, setDemoOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [webdavOpen, setWebdavOpen] = useState(false);
  const [webdavName, setWebdavName] = useState("");
  const [webdavUrl, setWebdavUrl] = useState("");
  const [webdavUser, setWebdavUser] = useState("");
  const [webdavPass, setWebdavPass] = useState("");

  const handleCreateProject = useCallback(async () => {
    const name = newName.trim();
    if (name === "") return;
    try {
      const project = await addProject(name, {
        provider: "indexeddb",
        storeId: uuidv7(),
      });
      setNewOpen(false);
      setNewName("");
      void navigate(`/projects/${project.slug}`);
    } catch (error) {
      console.error(error);
      showError({
        title: "Failed to create project",
        description: errorMessage(error),
      });
    }
  }, [newName, navigate, showError]);

  const handleConnectWebDav = useCallback(async () => {
    const name = webdavName.trim();
    const url = webdavUrl.trim();
    if (name === "" || url === "") return;
    const user = webdavUser.trim();
    try {
      const project = await addProject(name, {
        provider: "webdav",
        url,
        ...(user === "" ? {} : { username: user, password: webdavPass }),
      });
      setWebdavOpen(false);
      setWebdavName("");
      setWebdavUrl("");
      setWebdavUser("");
      setWebdavPass("");
      void navigate(`/projects/${project.slug}`);
    } catch (error) {
      console.error(error);
      showError({
        title: "Failed to connect WebDAV server",
        description: errorMessage(error),
      });
    }
  }, [webdavName, webdavUrl, webdavUser, webdavPass, navigate, showError]);

  const handleOpenFolder = useCallback(async () => {
    if (!isFileSystemAccessSupported()) {
      showError({
        title: "Open Folder is not available in this browser",
        description:
          "Opening a project folder uses the File System Access API, which currently requires a Chromium-based desktop browser (Chrome, Edge, or Brave). On iPad and other unsupported browsers, use New Project instead.",
      });
      return;
    }
    try {
      const handle = await showDirectoryPicker();
      const project = await addProject(handle.name, {
        provider: "filesystem",
        handle,
      });
      void navigate(`/projects/${project.slug}`);
    } catch (error) {
      if (!(error instanceof Error) || error.name !== "AbortError") {
        console.error(error);
        showError({
          title: "Failed to open folder",
          description: errorMessage(error),
        });
      }
    }
  }, [navigate, showError]);

  const handleTryDemo = useCallback(
    async (exampleName: string, displayName: string) => {
      try {
        const project = await addProject(displayName, {
          provider: "examples",
          name: exampleName,
        });
        setDemoOpen(false);
        void navigate(`/projects/${project.slug}`);
      } catch (error) {
        console.error(error);
        showError({
          title: "Failed to create demo project",
          description: errorMessage(error),
        });
      }
    },
    [navigate, showError],
  );

  const handleRemove = useCallback(
    async (slug: string) => {
      try {
        await removeProject(slug);
        void revalidator.revalidate();
      } catch (error) {
        console.error(error);
        showError({
          title: "Failed to remove project",
          description: errorMessage(error),
        });
      }
    },
    [revalidator, showError],
  );

  return (
    <Box p="4">
      <Flex direction="column" gap="4" align="center">
        <Heading size="8">Beat Muser</Heading>
        <Flex gap="2">
          <Button
            onClick={() => {
              setNewOpen(true);
            }}
          >
            New Project
          </Button>
          <Button
            variant="soft"
            onClick={() => {
              void handleOpenFolder();
            }}
          >
            Open Folder
          </Button>
          <Button
            variant="soft"
            onClick={() => {
              setWebdavOpen(true);
            }}
          >
            Connect WebDAV
          </Button>
          <Button
            variant="soft"
            onClick={() => {
              setDemoOpen(true);
            }}
          >
            Try Demo
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              void navigate("/extensions");
            }}
          >
            Manage Extensions
          </Button>
        </Flex>
        <Flex direction="column" gap="2" width="100%" style={{ maxWidth: 600 }}>
          {projects.map((project) => (
            <Card
              key={project.slug}
              onClick={() => {
                void navigate(`/projects/${project.slug}`);
              }}
              style={{ cursor: "pointer" }}
            >
              <Flex justify="between" align="center">
                <Flex direction="column">
                  <Text weight="bold">{project.displayName}</Text>
                  <Text size="1" color="gray">
                    Last opened {new Date(project.lastOpenedAt).toLocaleDateString()}
                  </Text>
                </Flex>
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger>
                    <IconButton
                      variant="ghost"
                      size="1"
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      ⋯
                    </IconButton>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content>
                    <DropdownMenu.Item
                      color="red"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleRemove(project.slug);
                      }}
                    >
                      Remove
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Root>
              </Flex>
            </Card>
          ))}
        </Flex>
      </Flex>

      <Dialog.Root open={newOpen} onOpenChange={setNewOpen}>
        <Dialog.Content maxWidth="450px">
          <Dialog.Title>New Project</Dialog.Title>
          <Dialog.Description size="2" mb="4">
            Files for this project are stored in your browser (IndexedDB). Upload audio and export
            your work from the Files panel inside the editor.
          </Dialog.Description>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleCreateProject();
            }}
          >
            <TextField.Root
              placeholder="Project name"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
              }}
              // oxlint-disable-next-line jsx-a11y/no-autofocus -- intentional focus of the dialog's primary input when it opens
              autoFocus
            />
            <Flex gap="2" mt="4" justify="end">
              <Dialog.Close>
                <Button variant="soft" color="gray" type="button">
                  Cancel
                </Button>
              </Dialog.Close>
              <Button type="submit" disabled={newName.trim() === ""}>
                Create
              </Button>
            </Flex>
          </form>
        </Dialog.Content>
      </Dialog.Root>

      <Dialog.Root open={webdavOpen} onOpenChange={setWebdavOpen}>
        <Dialog.Content maxWidth="450px">
          <Dialog.Title>Connect a WebDAV Server</Dialog.Title>
          <Dialog.Description size="2" mb="4">
            Files for this project live on a remote WebDAV server (e.g. dufs). The server must
            enable CORS and, if writing, allow uploads and deletes. Leave the username blank for
            anonymous access.
          </Dialog.Description>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleConnectWebDav();
            }}
          >
            <Flex direction="column" gap="2">
              <TextField.Root
                placeholder="Project name"
                value={webdavName}
                onChange={(e) => {
                  setWebdavName(e.target.value);
                }}
                // oxlint-disable-next-line jsx-a11y/no-autofocus -- intentional focus of the dialog's primary input when it opens
                autoFocus
              />
              <TextField.Root
                placeholder="Server URL (https://host:5000/path/)"
                value={webdavUrl}
                onChange={(e) => {
                  setWebdavUrl(e.target.value);
                }}
              />
              <TextField.Root
                placeholder="Username (optional)"
                value={webdavUser}
                onChange={(e) => {
                  setWebdavUser(e.target.value);
                }}
                autoComplete="username"
              />
              <TextField.Root
                type="password"
                placeholder="Password (optional)"
                value={webdavPass}
                onChange={(e) => {
                  setWebdavPass(e.target.value);
                }}
                autoComplete="current-password"
              />
            </Flex>
            <Flex gap="2" mt="4" justify="end">
              <Dialog.Close>
                <Button variant="soft" color="gray" type="button">
                  Cancel
                </Button>
              </Dialog.Close>
              <Button type="submit" disabled={webdavName.trim() === "" || webdavUrl.trim() === ""}>
                Connect
              </Button>
            </Flex>
          </form>
        </Dialog.Content>
      </Dialog.Root>

      <Dialog.Root open={demoOpen} onOpenChange={setDemoOpen}>
        <Dialog.Content maxWidth="450px">
          <Dialog.Title>Try a Demo Project</Dialog.Title>
          <Dialog.Description size="2" mb="4">
            Select a demo project to explore the app.
          </Dialog.Description>
          <Flex direction="column" gap="2">
            <Button
              variant="soft"
              onClick={() => {
                void handleTryDemo("recursivedescent", "RECURSIVE DESCENT");
              }}
            >
              RECURSIVE DESCENT
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Box>
  );
}
