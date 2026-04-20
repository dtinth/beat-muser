import { useCallback, useState } from "react";
import { useNavigate, useLoaderData, useRevalidator } from "react-router";
import {
  Box,
  Button,
  Card,
  Flex,
  Heading,
  Text,
  DropdownMenu,
  IconButton,
  Dialog,
} from "@radix-ui/themes";
import { addProject, removeProject } from "../project-store";
import { showDirectoryPicker } from "../file-system";
import type { Project } from "../project-store/types";

export function ProjectListPage() {
  const projects = useLoaderData() as Project[];
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const [demoOpen, setDemoOpen] = useState(false);

  const handleOpenFolder = useCallback(async () => {
    try {
      const handle = await showDirectoryPicker();
      // TODO: request permission and handle denial
      const project = await addProject(handle.name, {
        provider: "filesystem",
        handle,
      });
      void navigate(`/${project.slug}`);
    } catch {
      // User cancelled
    }
  }, [navigate]);

  const handleTryDemo = useCallback(
    async (name: string) => {
      const project = await addProject(name, {
        provider: "examples",
        name,
      });
      setDemoOpen(false);
      void navigate(`/${project.slug}`);
    },
    [navigate],
  );

  const handleRemove = useCallback(
    async (slug: string) => {
      await removeProject(slug);
      void revalidator.revalidate();
    },
    [revalidator],
  );

  return (
    <Box p="4">
      <Flex direction="column" gap="4" align="center">
        <Heading size="8">Beat Muser</Heading>
        <Flex gap="2">
          <Button onClick={handleOpenFolder}>Open Folder</Button>
          <Button variant="soft" onClick={() => setDemoOpen(true)}>
            Try Demo
          </Button>
        </Flex>
        <Flex direction="column" gap="2" width="100%" style={{ maxWidth: 600 }}>
          {projects.map((project) => (
            <Card
              key={project.slug}
              onClick={() => navigate(`/${project.slug}`)}
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
                    <IconButton variant="ghost" size="1" onClick={(e) => e.stopPropagation()}>
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

      <Dialog.Root open={demoOpen} onOpenChange={setDemoOpen}>
        <Dialog.Content maxWidth="450px">
          <Dialog.Title>Try a Demo Project</Dialog.Title>
          <Dialog.Description size="2" mb="4">
            Select a demo project to explore the app.
          </Dialog.Description>
          <Flex direction="column" gap="2">
            <Button variant="soft" onClick={() => handleTryDemo("demo1")}>
              Demo 1
            </Button>
            <Button variant="soft" onClick={() => handleTryDemo("demo2")}>
              Demo 2
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Box>
  );
}
