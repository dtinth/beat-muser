import { test, expect } from "vite-plus/test";
import { createFileSystemFromExample } from "./demo-fs.ts";
import { parseProjectFile } from "../project-format/index.ts";

test("lists files for the recursivedescent example", async () => {
  const fs = createFileSystemFromExample("recursivedescent");
  const files = await fs.listFiles();
  expect(files.some((f) => f.name === "beat-muser-project.json")).toBe(true);
  expect(files.some((f) => f.name === "synth.ogg")).toBe(true);
});

test("exposes paths relative to the example directory", async () => {
  const fs = createFileSystemFromExample("recursivedescent");
  const text = await fs.readText("beat-muser-project.json");
  const project = parseProjectFile(text);
  expect(project.metadata.title).toBe("RECURSIVE DESCENT");
  expect(project.entities.length).toBeGreaterThan(0);
});

test("throws for missing file", async () => {
  const fs = createFileSystemFromExample("recursivedescent");
  await expect(fs.readText("nonexistent.json")).rejects.toThrow("File not found");
});

test("is read-only", async () => {
  const fs = createFileSystemFromExample("recursivedescent");
  expect(fs.readOnly).toBe(true);
  await expect(fs.writeFile("x.json", "{}")).rejects.toThrow("Demo file system is read-only");
  await expect(fs.deleteFile("beat-muser-project.json")).rejects.toThrow(
    "Demo file system is read-only",
  );
});
