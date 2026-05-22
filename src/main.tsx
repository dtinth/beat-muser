import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@radix-ui/themes/styles.css";
import { RouterProvider } from "react-router";
import { router } from "./routes.tsx";
import { ToastProvider } from "./packlets/toast/index.tsx";

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  </StrictMode>,
);
