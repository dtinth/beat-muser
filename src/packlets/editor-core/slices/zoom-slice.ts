import { atom } from "nanostores";
import { Slice } from "../slice.ts";

export class ZoomSlice extends Slice {
  static readonly sliceKey = "zoom";

  $zoom = atom<number>(1);
}
