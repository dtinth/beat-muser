import { atom } from "nanostores";
import { Slice } from "../slice.ts";
import { Point } from "../../geometry/index.ts";

export class CursorSlice extends Slice {
  static readonly sliceKey = "cursor";

  $cursorPulse = atom<number>(0);
  $cursorViewportPos = atom<Point>({ x: 0, y: -1 });
  $cursorColumnId = atom<string | null>(null);
}
