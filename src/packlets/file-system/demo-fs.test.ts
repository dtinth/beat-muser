import { test, expect } from "vite-plus/test";
import { createFileSystemFromExample } from "./demo-fs.ts";

test("lists files for demo1", async () => {
  const fs = createFileSystemFromExample("demo1");
  const files = await fs.listFiles();
  expect(files.some((f) => f.name === "beatmap.json")).toBe(true);
});

test("reads beatmap.json for demo1", async () => {
  const fs = createFileSystemFromExample("demo1");
  const text = await fs.readText("demo1/beatmap.json");
  expect(JSON.parse(text)).toEqual({});
});

test("throws for missing file", async () => {
  const fs = createFileSystemFromExample("demo1");
  await expect(fs.readText("demo1/nonexistent.json")).rejects.toThrow();
});

test("is read-only", async () => {
  const fs = createFileSystemFromExample("demo1");
  expect(fs.readOnly).toBe(true);
  await expect(fs.writeFile("demo1/x.json", "{}")).rejects.toThrow();
  await expect(fs.deleteFile("demo1/beatmap.json")).rejects.toThrow();
});
