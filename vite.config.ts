import { defineConfig } from "vite-plus";

export default defineConfig({
  server: { port: 15036 },
  test: { exclude: ["**/node_modules/**", "**/tests/**"] },
  staged: {
    "*": "vp check --fix",
  },
  fmt: {},
  lint: { options: { typeAware: true, typeCheck: true } },
});
