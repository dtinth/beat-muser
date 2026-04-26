/**
 * @packageDocumentation
 *
 * Minimal 2D geometry primitives for the editor.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Dimension {
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const Rect = {
  center(r: Rect): Point {
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  },

  contains(r: Rect, p: Point): boolean {
    return p.x >= r.x && p.x < r.x + r.width && p.y >= r.y && p.y < r.y + r.height;
  },

  expand(r: Rect, amount: number): Rect {
    return {
      x: r.x - amount,
      y: r.y - amount,
      width: r.width + amount * 2,
      height: r.height + amount * 2,
    };
  },
};

export const Point = {
  distance(a: Point, b: Point): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  },
};
