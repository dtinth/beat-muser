import { describe, expect, test } from "vite-plus/test";
import { Point, Rect } from "./index";

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

describe("Rect.center", () => {
  test("returns the geometric center", () => {
    expect(Rect.center({ x: 10, y: 20, width: 30, height: 40 })).toEqual({ x: 25, y: 40 });
  });

  test("works with zero origin", () => {
    expect(Rect.center({ x: 0, y: 0, width: 10, height: 10 })).toEqual({ x: 5, y: 5 });
  });
});

describe("Rect.contains", () => {
  test("returns true for a point inside", () => {
    expect(Rect.contains({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5 })).toBe(true);
  });

  test("returns false for a point outside", () => {
    expect(Rect.contains({ x: 0, y: 0, width: 10, height: 10 }, { x: 15, y: 5 })).toBe(false);
  });

  test("returns false for a point on the right edge (half-open)", () => {
    expect(Rect.contains({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 5 })).toBe(false);
  });

  test("returns true for a point on the left edge", () => {
    expect(Rect.contains({ x: 0, y: 0, width: 10, height: 10 }, { x: 0, y: 5 })).toBe(true);
  });
});

describe("Rect.expand", () => {
  test("expands uniformly in all directions", () => {
    expect(Rect.expand({ x: 10, y: 20, width: 30, height: 40 }, 5)).toEqual({
      x: 5,
      y: 15,
      width: 40,
      height: 50,
    });
  });

  test("works with zero amount", () => {
    expect(Rect.expand({ x: 0, y: 0, width: 10, height: 10 }, 0)).toEqual({
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    });
  });
});
