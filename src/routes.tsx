import { createBrowserRouter, Outlet } from "react-router";
import App from "./App";

export const router = createBrowserRouter([
  {
    element: <App />,
    children: [
      {
        path: "/",
        element: <Outlet />,
        children: [
          {
            index: true,
            element: <div>Home</div>,
          },
        ],
      },
    ],
  },
]);
