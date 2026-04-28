import { atom } from "nanostores";
import { Slice } from "../slice";
import type { EditorContext } from "../editor-context";

export class ZoomSlice extends Slice {
  static readonly sliceKey = "zoom";

  $zoom = atom<number>(1);

  constructor(ctx: EditorContext) {
    super(ctx);
  }
}
