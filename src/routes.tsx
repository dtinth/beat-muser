import { createBrowserRouter, Outlet } from "react-router";
import { Theme } from "@radix-ui/themes";
import { AppHeader } from "./packlets/app-header";
import { ProjectListPage } from "./packlets/project-list";
import { ProjectViewPage } from "./packlets/project-view";
import { ScrollableCanvasTestPage } from "./packlets/scrollable-canvas-test";
import { ErrorPage } from "./packlets/error-page";
import { uuidv7 } from "uuidv7";
import type { ProjectSource } from "./packlets/project-store/types";
import {
  listProjects,
  getProjectBySlug,
  DEMO_SLUG,
  createDemoProjectFile,
} from "./packlets/project-store";
import { createProjectFileSystem } from "./packlets/file-system";
import { parseProjectFile } from "./packlets/project-format";
import type { ProjectFile } from "./packlets/project-format";

export const router = createBrowserRouter([
  {
    element: (
      <Theme
        appearance="dark"
        accentColor="lime"
        style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <AppHeader />
        <div
          style={{
            flex: 1,
            overflow: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Outlet />
        </div>
      </Theme>
    ),
    errorElement: <ErrorPage />,
    children: [
      {
        index: true,
        loader: async () => listProjects(),
        element: <ProjectListPage />,
      },
      {
        path: "projects/:slug",
        loader: async ({ params }) => {
          let source: ProjectSource;
          if (params.slug === DEMO_SLUG) {
            source = { provider: "examples", name: "demo" };
          } else {
            const project = await getProjectBySlug(params.slug!);
            if (!project) {
              throw new Response("Project not found", { status: 404 });
            }
            source = project.source;
          }

          let projectFile: ProjectFile;
          if (source.provider === "examples") {
            projectFile = createDemoProjectFile();
          } else {
            const fs = createProjectFileSystem(source);
            try {
              const handle = source.handle;
              const permission = await (handle as any).requestPermission({ mode: "read" });
              if (permission !== "granted") {
                throw new Error(
                  "Folder access was denied. Reopen the project to re-grant permission.",
                );
              }
            } catch (e) {
              console.error("Permission or read error:", e);
              if (e instanceof DOMException && e.name === "NotFoundError") {
                projectFile = {
                  schemaVersion: 2,
                  version: uuidv7(),
                  metadata: { title: "Untitled", artist: "", genre: "" },
                  entities: [],
                };
              } else {
                throw new Response(`Failed to load project: ${(e as Error).message}`, {
                  status: 500,
                });
              }
            }
            try {
              const json = await fs.readText("beat-muser-project.json");
              projectFile = parseProjectFile(json);
            } catch (error) {
              const isNotFound = error instanceof DOMException && error.name === "NotFoundError";
              if (isNotFound) {
                projectFile = {
                  schemaVersion: 2,
                  version: uuidv7(),
                  metadata: { title: "Untitled", artist: "", genre: "" },
                  entities: [],
                };
              } else {
                console.error("Failed to load project:", error);
                throw new Response(`Failed to load project: ${(error as Error).message}`, {
                  status: 500,
                });
              }
            }
          }
          return { projectFile, source };
        },
        element: <ProjectViewPage />,
      },
      {
        path: "test/scrollable-canvas",
        element: <ScrollableCanvasTestPage />,
      },
    ],
  },
]);
