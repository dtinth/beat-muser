/**
 * Unit tests for binary search utilities.
 */

import { describe, it, expect } from "vite-plus/test";
import { bisectLeft, bisectRight, bisectRightBy } from "./index";

describe("bisectLeft", () => {
  it("finds the first element >= x", () => {
    const arr = [1, 3, 5, 7, 9];
    expect(bisectLeft(arr, 0)).toBe(0);
    expect(bisectLeft(arr, 1)).toBe(0);
    expect(bisectLeft(arr, 4)).toBe(2);
    expect(bisectLeft(arr, 5)).toBe(2);
    expect(bisectLeft(arr, 9)).toBe(4);
    expect(bisectLeft(arr, 10)).toBe(5);
  });

  it("handles empty arrays", () => {
    expect(bisectLeft([], 5)).toBe(0);
  });

  it("handles single-element arrays", () => {
    expect(bisectLeft([5], 3)).toBe(0);
    expect(bisectLeft([5], 5)).toBe(0);
    expect(bisectLeft([5], 7)).toBe(1);
  });
});

describe("bisectRight", () => {
  it("finds the first element > x", () => {
    const arr = [1, 3, 5, 7, 9];
    expect(bisectRight(arr, 0)).toBe(0);
    expect(bisectRight(arr, 1)).toBe(1);
    expect(bisectRight(arr, 4)).toBe(2);
    expect(bisectRight(arr, 5)).toBe(3);
    expect(bisectRight(arr, 9)).toBe(5);
    expect(bisectRight(arr, 10)).toBe(5);
  });

  it("handles empty arrays", () => {
    expect(bisectRight([], 5)).toBe(0);
  });

  it("handles single-element arrays", () => {
    expect(bisectRight([5], 3)).toBe(0);
    expect(bisectRight([5], 5)).toBe(1);
    expect(bisectRight([5], 7)).toBe(1);
  });
});

describe("bisectRightBy", () => {
  it("finds the first element whose key is > x", () => {
    const arr = [
      { id: "a", pulse: 1 },
      { id: "b", pulse: 3 },
      { id: "c", pulse: 5 },
    ];
    expect(bisectRightBy(arr, 0, (e) => e.pulse)).toBe(0);
    expect(bisectRightBy(arr, 1, (e) => e.pulse)).toBe(1);
    expect(bisectRightBy(arr, 4, (e) => e.pulse)).toBe(2);
    expect(bisectRightBy(arr, 5, (e) => e.pulse)).toBe(3);
    expect(bisectRightBy(arr, 10, (e) => e.pulse)).toBe(3);
  });

  it("handles empty arrays", () => {
    expect(bisectRightBy([], 5, (e: { pulse: number }) => e.pulse)).toBe(0);
  });
});
