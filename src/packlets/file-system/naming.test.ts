import { test, expect } from "vite-plus/test";
import { nextAvailableName } from "./naming.ts";

test("returns the name unchanged when there is no collision", () => {
  expect(nextAvailableName(new Set(), "kick.mp3")).toBe("kick.mp3");
});

test("appends a numeric suffix before the extension on collision", () => {
  expect(nextAvailableName(new Set(["kick.mp3"]), "kick.mp3")).toBe("kick-1.mp3");
});

test("skips suffixes already taken", () => {
  const existing = new Set(["kick.mp3", "kick-1.mp3", "kick-2.mp3"]);
  expect(nextAvailableName(existing, "kick.mp3")).toBe("kick-3.mp3");
});

test("handles names without an extension", () => {
  expect(nextAvailableName(new Set(["README"]), "README")).toBe("README-1");
});

test("only treats the final dot as the extension boundary", () => {
  expect(nextAvailableName(new Set(["a.b.c"]), "a.b.c")).toBe("a.b-1.c");
});
