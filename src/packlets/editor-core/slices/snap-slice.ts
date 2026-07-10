import { atom } from "nanostores";
import { createNanoEvents } from "nanoevents";
import { Slice } from "../slice.ts";

export class SnapSlice extends Slice {
  static readonly sliceKey = "snap";

  $snap = atom<string>("1/16");
  private events = createNanoEvents<{ snapChanged: (snap: string) => void }>();

  setSnap(snap: string): void {
    this.$snap.set(snap);
    this.events.emit("snapChanged", snap);
  }

  onSnapChanged(cb: (snap: string) => void): () => void {
    return this.events.on("snapChanged", cb);
  }
}
