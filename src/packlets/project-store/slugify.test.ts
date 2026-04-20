import { test, expect } from "vite-plus/test";
import { slugify } from "./slugify";

test("slugifies a simple name", () => {
  expect(slugify("My Project")).toBe("my-project");
});

test("slugifies with special characters", () => {
  expect(slugify("Beat Map #1!")).toBe("beat-map-1");
});

test("handles leading/trailing separators", () => {
  expect(slugify("-my project-")).toBe("my-project");
});

test("handles multiple consecutive separators", () => {
  expect(slugify("my   project")).toBe("my-project");
});

test("lowercases everything", () => {
  expect(slugify("UPPER CASE")).toBe("upper-case");
});
