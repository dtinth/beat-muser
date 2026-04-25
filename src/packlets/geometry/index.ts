/**
 * @packageDocumentation
 *
 * Minimal 2D geometry primitives for the editor.
 */

export interface Point {
  x: number;
  y: number;
}

export const Point = {
  distance(a: Point, b: Point): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  },
};
