import { atom } from "nanostores";
import { Slice } from "../slice";
import { Point } from "../../geometry";

export class CursorSlice extends Slice {
  static readonly sliceKey = "cursor";

  $cursorPulse = atom<number>(0);
  $cursorViewportPos = atom<Point>({ x: 0, y: -1 });
}
