import { createBrowserRouter, Outlet } from "react-router";
import { Theme } from "@radix-ui/themes";
import { AppHeader } from "./packlets/app-header/index.tsx";
import { ProjectListPage } from "./packlets/project-list/index.tsx";
import { ProjectViewPage } from "./packlets/project-view/index.tsx";
import { ScrollableCanvasTestPage } from "./packlets/scrollable-canvas-test/index.tsx";
import { ExtensionManagerPage } from "./packlets/extension-manager/index.tsx";
import { ErrorPage } from "./packlets/error-page/index.tsx";
import { uuidv7 } from "uuidv7";
import type { ProjectSource } from "./packlets/project-store/types.ts";
import {
  listProjects,
  getProjectBySlug,
  DEMO_SLUG,
  createProjectFileSystem,
} from "./packlets/project-store/index.ts";
import { isFileNotFoundError } from "./packlets/file-system/index.ts";
import { parseProjectFile } from "./packlets/project-format/index.ts";
import type { ProjectFile } from "./packlets/project-format/index.ts";
import { getExtensionManager } from "./packlets/extensions/index.ts";

// The File System Access API's permission methods are not yet in the TS DOM
// lib types; augment the handle so we can call them without an `any` cast.
declare global {
  interface FileSystemDirectoryHandle {
    requestPermission(descriptor: { mode: "read" | "readwrite" }): Promise<PermissionState>;
  }
}

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
        loader: () => listProjects(),
        element: <ProjectListPage />,
      },
      {
        path: "projects/:slug",
        loader: async ({ params, request }) => {
          await Promise.all([
            getExtensionManager().initFromUrl(request.url),
            getExtensionManager().initFromStorage(),
          ]);

          let source: ProjectSource;
          if (params.slug === DEMO_SLUG) {
            source = { provider: "examples", name: "recursivedescent" };
          } else {
            const project = await getProjectBySlug(params.slug!);
            if (!project) {
              // oxlint-disable-next-line typescript/only-throw-error -- react-router loaders throw Response to trigger HTTP error handling
              throw new Response("Project not found", { status: 404 });
            }
            source = project.source;
          }

          let projectFile: ProjectFile;
          {
            const fs = createProjectFileSystem(source);
            try {
              // The File System Access API requires re-granting read permission
              // each session; other backends need no permission gate.
              if (source.provider === "filesystem") {
                const permission = await source.handle.requestPermission({ mode: "read" });
                if (permission !== "granted") {
                  // oxlint-disable-next-line typescript/only-throw-error -- react-router loaders throw Response to trigger HTTP error handling
                  throw new Response(
                    "Folder access was denied. Reopen the project to re-grant permission.",
                    { status: 403 },
                  );
                }
              }
              const json = await fs.readText("beat-muser-project.json");
              projectFile = parseProjectFile(json);
            } catch (error) {
              if (error instanceof Response) throw error;
              // A missing project file (or a deleted folder) means a fresh,
              // empty project rather than a load failure.
              if (isFileNotFoundError(error)) {
                projectFile = {
                  schemaVersion: 2,
                  version: uuidv7(),
                  metadata: { title: "Untitled", artist: "", genre: "" },
                  entities: [],
                };
              } else {
                console.error("Failed to load project:", error);
                const message = error instanceof Error ? error.message : String(error);
                // oxlint-disable-next-line typescript/only-throw-error -- react-router loaders throw Response to trigger HTTP error handling
                throw new Response(`Failed to load project: ${message}`, {
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
        path: "extensions",
        element: <ExtensionManagerPage />,
      },
      {
        path: "test/scrollable-canvas",
        element: <ScrollableCanvasTestPage />,
      },
    ],
  },
]);
