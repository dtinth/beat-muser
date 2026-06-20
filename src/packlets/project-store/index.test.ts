import "fake-indexeddb/auto";
import { test, expect } from "vite-plus/test";
import { addProject, removeProject, createProjectFileSystem } from "./index.ts";
import { uuidv7 } from "uuidv7";

test("removing an IndexedDB project deletes its stored files", async () => {
  const storeId = uuidv7();
  const project = await addProject("iPad Chart", { provider: "indexeddb", storeId });

  const fs = createProjectFileSystem(project.source);
  await fs.writeFile("beat-muser-project.json", "{}");
  await fs.writeFile("kick.mp3", "audio");
  expect(await fs.listFiles()).toHaveLength(2);

  await removeProject(project.slug);

  expect(await fs.listFiles()).toHaveLength(0);
});
