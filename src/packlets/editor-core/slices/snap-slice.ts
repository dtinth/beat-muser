import { atom } from "nanostores";
import { createNanoEvents } from "nanoevents";
import { Slice } from "../slice";
import type { EditorContext } from "../editor-context";

export class SnapSlice extends Slice {
  static readonly sliceKey = "snap";
  static readonly layer = 0;

  $snap = atom<string>("1/16");
  private events = createNanoEvents<{ snapChanged: (snap: string) => void }>();

  constructor(ctx: EditorContext) {
    super(ctx);
  }

  setSnap(snap: string): void {
    this.$snap.set(snap);
    this.events.emit("snapChanged", snap);
  }

  onSnapChanged(cb: (snap: string) => void): () => void {
    return this.events.on("snapChanged", cb);
  }
}
