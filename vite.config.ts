import { defineConfig } from "vite-plus";

export default defineConfig({
  server: { port: 15036 },
  test: {
    exclude: ["**/node_modules/**", "**/tests/**"],
    setupFiles: process.env.CI ? ["allure-vitest/setup"] : [],
    reporters: process.env.CI
      ? [
          "default",
          "github-actions",
          ["allure-vitest/reporter", { resultsDir: "ci-reports/allure-results-vitest" }],
        ]
      : ["default"],
    coverage: {
      provider: "v8",
      reporter: ["html", "text-summary"],
      reportsDirectory: "ci-reports/coverage",
      include: ["src/**/*.{ts,tsx}"],
    },
  },
  staged: {
    "*": "vp check --fix",
  },
  fmt: {},
  lint: { options: { typeAware: true, typeCheck: true } },
});
