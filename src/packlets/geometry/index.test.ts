import { describe, expect, test } from "vite-plus/test";
import { Point } from "./index";

describe("Point", () => {
  test("distance between identical points is zero", () => {
    expect(Point.distance({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0);
  });

  test("distance along X axis", () => {
    expect(Point.distance({ x: 0, y: 0 }, { x: 3, y: 0 })).toBe(3);
  });

  test("distance along Y axis", () => {
    expect(Point.distance({ x: 0, y: 0 }, { x: 0, y: 4 })).toBe(4);
  });

  test("diagonal distance (3-4-5 triangle)", () => {
    expect(Point.distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});
