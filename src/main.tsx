import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Theme } from "@radix-ui/themes";
// @ts-expect-error CSS import
import "@radix-ui/themes/styles.css";
import App from "./App";

/// <reference types="vite/client" />

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <Theme appearance="dark" accentColor="lime">
      <App />
    </Theme>
  </StrictMode>,
);
