import { defineConfig } from "vite-plus";

export default defineConfig({
  server: { port: 15036 },
  staged: {
    "*": "vp check --fix",
  },
  fmt: {},
  lint: { options: { typeAware: true, typeCheck: true } },
});
