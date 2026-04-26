import { atom } from "nanostores";
import { createNanoEvents } from "nanoevents";
import { Slice } from "../slice";
import type { EditorContext } from "../editor-context";
import { ZOOM_PRESETS } from "../types";

export class ZoomSlice extends Slice {
  static readonly sliceKey = "zoom";
  static readonly layer = 0;

  $zoom = atom<number>(1);
  private events = createNanoEvents<{
    zoomChanged: (payload: { oldZoom: number; newZoom: number }) => void;
  }>();

  constructor(ctx: EditorContext) {
    super(ctx);
  }

  setZoom(zoom: number): void {
    const prevZoom = this.$zoom.get();
    this.$zoom.set(zoom);
    this.events.emit("zoomChanged", { oldZoom: prevZoom, newZoom: zoom });
  }

  zoomIn(): void {
    const current = this.$zoom.get();
    const next = ZOOM_PRESETS.find((z) => z > current);
    if (next) this.setZoom(next);
  }

  zoomOut(): void {
    const current = this.$zoom.get();
    const prev = [...ZOOM_PRESETS].reverse().find((z) => z < current);
    if (prev) this.setZoom(prev);
  }

  onZoomChanged(cb: (payload: { oldZoom: number; newZoom: number }) => void): () => void {
    return this.events.on("zoomChanged", cb);
  }
}
