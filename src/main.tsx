import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// oxlint-disable-next-line import/no-unassigned-import -- side-effect import of global stylesheet
import "@radix-ui/themes/styles.css";
import { RouterProvider } from "react-router";
import { router } from "./routes.tsx";
import { ToastProvider } from "./packlets/toast/index.tsx";

createRoot(document.querySelector("#app")!).render(
  <StrictMode>
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  </StrictMode>,
);
