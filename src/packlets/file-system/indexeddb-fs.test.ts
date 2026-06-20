import "fake-indexeddb/auto";
import { test, expect } from "vite-plus/test";
import { uuidv7 } from "uuidv7";
import {
  createFileSystemFromIndexedDb,
  deleteIndexedDbStore,
  isFileNotFoundError,
} from "./indexeddb-fs.ts";

test("writeFile then readText round-trips text", async () => {
  const fs = createFileSystemFromIndexedDb(uuidv7());
  await fs.writeFile("notes.txt", "hello world");
  expect(await fs.readText("notes.txt")).toBe("hello world");
});

test("writeFile then readFile round-trips binary bytes", async () => {
  const fs = createFileSystemFromIndexedDb(uuidv7());
  const bytes = new Uint8Array([0, 1, 2, 255, 128]);
  await fs.writeFile("audio.bin", bytes.buffer);
  const read = new Uint8Array(await fs.readFile("audio.bin"));
  expect([...read]).toEqual([...bytes]);
});

test("listFiles reports name, path, and size", async () => {
  const fs = createFileSystemFromIndexedDb(uuidv7());
  await fs.writeFile("kick.mp3", "1234567890");
  const files = await fs.listFiles();
  expect(files).toHaveLength(1);
  expect(files[0]).toMatchObject({ name: "kick.mp3", path: "kick.mp3", size: 10 });
});

test("listFiles derives name from the basename of a nested path", async () => {
  const fs = createFileSystemFromIndexedDb(uuidv7());
  await fs.writeFile("audio/drums/snare.wav", "x");
  const [entry] = await fs.listFiles();
  expect(entry).toMatchObject({ name: "snare.wav", path: "audio/drums/snare.wav" });
});

test("writeFile overwrites an existing file", async () => {
  const fs = createFileSystemFromIndexedDb(uuidv7());
  await fs.writeFile("a.txt", "first");
  await fs.writeFile("a.txt", "second-longer");
  expect(await fs.readText("a.txt")).toBe("second-longer");
  expect(await fs.listFiles()).toHaveLength(1);
});

test("deleteFile removes a file", async () => {
  const fs = createFileSystemFromIndexedDb(uuidv7());
  await fs.writeFile("gone.txt", "bye");
  await fs.deleteFile("gone.txt");
  expect(await fs.listFiles()).toHaveLength(0);
  await expect(fs.readFile("gone.txt")).rejects.toSatisfy(isFileNotFoundError);
});

test("readFile of a missing file throws a recognized not-found error", async () => {
  const fs = createFileSystemFromIndexedDb(uuidv7());
  await expect(fs.readFile("missing.txt")).rejects.toSatisfy(isFileNotFoundError);
});

test("file systems are isolated by storeId", async () => {
  const a = createFileSystemFromIndexedDb(uuidv7());
  const b = createFileSystemFromIndexedDb(uuidv7());
  await a.writeFile("shared.txt", "from-a");
  expect(await a.listFiles()).toHaveLength(1);
  expect(await b.listFiles()).toHaveLength(0);
  await expect(b.readFile("shared.txt")).rejects.toSatisfy(isFileNotFoundError);
});

test("deleteIndexedDbStore drops one store's files but leaves others intact", async () => {
  const idA = uuidv7();
  const idB = uuidv7();
  const a = createFileSystemFromIndexedDb(idA);
  const b = createFileSystemFromIndexedDb(idB);
  await a.writeFile("one.txt", "1");
  await a.writeFile("two.txt", "2");
  await b.writeFile("keep.txt", "k");

  await deleteIndexedDbStore(idA);

  expect(await a.listFiles()).toHaveLength(0);
  expect(await b.listFiles()).toHaveLength(1);
  expect(await b.readText("keep.txt")).toBe("k");
});

test("a writable file system reports readOnly false", () => {
  expect(createFileSystemFromIndexedDb(uuidv7()).readOnly).toBe(false);
});
