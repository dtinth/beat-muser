import { createBrowserRouter, Outlet } from "react-router";
import { Theme } from "@radix-ui/themes";
import { ProjectListPage } from "./packlets/project-list";
import { ProjectViewPage } from "./packlets/project-view";

export const router = createBrowserRouter([
  {
    element: (
      <Theme appearance="dark" accentColor="lime">
        <Outlet />
      </Theme>
    ),
    children: [
      {
        index: true,
        element: <ProjectListPage />,
      },
      {
        path: ":slug",
        element: <ProjectViewPage />,
      },
    ],
  },
]);
