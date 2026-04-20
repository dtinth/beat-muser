import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Theme } from "@radix-ui/themes";
import "@radix-ui/themes/styles.css";
import { RouterProvider } from "react-router";
import { router } from "./routes";

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <Theme appearance="dark" accentColor="lime">
      <RouterProvider router={router} />
    </Theme>
  </StrictMode>,
);
