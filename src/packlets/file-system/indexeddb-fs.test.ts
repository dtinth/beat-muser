import "fake-indexeddb/auto";
import { test, expect } from "vite-plus/test";
import { uuidv7 } from "uuidv7";
import { createFileSystemFromIndexedDb } from "./indexeddb-fs.ts";

test("writeFile then readText round-trips text", async () => {
  const fs = createFileSystemFromIndexedDb(uuidv7());
  await fs.writeFile("notes.txt", "hello world");
  expect(await fs.readText("notes.txt")).toBe("hello world");
});
