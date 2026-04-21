import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@radix-ui/themes/styles.css";
import { RouterProvider } from "react-router";
import { router } from "./routes";
import { ToastProvider } from "./packlets/toast";

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  </StrictMode>,
);
