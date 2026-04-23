import { createBrowserRouter, Outlet } from "react-router";
import { Theme } from "@radix-ui/themes";
import { AppHeader } from "./packlets/app-header";
import { ProjectListPage } from "./packlets/project-list";
import { ProjectViewPage } from "./packlets/project-view";
import { ScrollableCanvasTestPage } from "./packlets/scrollable-canvas-test";
import {
  listProjects,
  getProjectBySlug,
  DEMO_SLUG,
  createDemoProjectFile,
} from "./packlets/project-store";

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
    children: [
      {
        index: true,
        loader: async () => listProjects(),
        element: <ProjectListPage />,
      },
      {
        path: "projects/:slug",
        loader: async ({ params }) => {
          if (params.slug === DEMO_SLUG) {
            return createDemoProjectFile();
          }
          const project = await getProjectBySlug(params.slug!);
          if (!project) {
            throw new Response("Project not found", { status: 404 });
          }
          // TODO: load actual ProjectFile from filesystem
          return createDemoProjectFile();
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
