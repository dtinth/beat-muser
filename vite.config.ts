import { defineConfig } from "vite-plus";

export default defineConfig({
  server: { port: 15036 },
  test: {
    exclude: ["**/node_modules/**", "**/tests/**"],
    reporters: process.env.CI ? ["default", "html"] : ["default"],
    outputFile: process.env.CI ? { html: "./ci-reports/vitest/index.html" } : undefined,
  },
  staged: {
    "*": "vp check --fix",
  },
  fmt: {},
  lint: { options: { typeAware: true, typeCheck: true } },
});
