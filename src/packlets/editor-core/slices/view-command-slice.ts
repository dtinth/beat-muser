import { Slice } from "../slice";
import type { EditorContext } from "../editor-context";
import { ZoomSlice } from "./zoom-slice";
import { ViewportSlice } from "./viewport-slice";
import { CursorSlice } from "./cursor-slice";
import { TimingSlice } from "./timing-slice";
import { ChartSlice } from "./chart-slice";
import { SnapSlice } from "./snap-slice";
import { BASE_SCALE_Y, ZOOM_PRESETS } from "../types";

export class ViewCommandSlice extends Slice {
  static readonly sliceKey = "viewCommand";

  constructor(ctx: EditorContext) {
    super(ctx);
  }

  setZoom(zoom: number): void {
    const zoomSlice = this.ctx.get(ZoomSlice);
    const viewport = this.ctx.get(ViewportSlice);
    const oldZoom = zoomSlice.$zoom.get();
    zoomSlice.$zoom.set(zoom);
    const newScrollTop = this.computeZoomScrollOffset(oldZoom, zoom);
    viewport.requestScroll({ x: viewport.$scroll.get().x, y: newScrollTop });
  }

  zoomIn(): void {
    const current = this.ctx.get(ZoomSlice).$zoom.get();
    const next = ZOOM_PRESETS.find((z) => z > current);
    if (next) this.setZoom(next);
  }

  zoomOut(): void {
    const current = this.ctx.get(ZoomSlice).$zoom.get();
    const prev = [...ZOOM_PRESETS].reverse().find((z) => z < current);
    if (prev) this.setZoom(prev);
  }

  navigateSnap(direction: "up" | "down"): void {
    const cursor = this.ctx.get(CursorSlice);
    const viewport = this.ctx.get(ViewportSlice);
    const currentPulse = cursor.$cursorPulse.get();
    const engine = this.ctx.get(TimingSlice).getTimingEngine();
    const snap = this.ctx.get(SnapSlice).$snap.get();
    const size = this.ctx.get(ChartSlice).getChartSize();

    let targetPulse: number;
    if (direction === "up") {
      const points = engine.getSnapPoints(snap, { start: currentPulse, end: size });
      const next = points.find((p) => p > currentPulse);
      targetPulse = next !== undefined ? next : currentPulse;
    } else {
      const points = engine.getSnapPoints(snap, { start: 0, end: currentPulse });
      const prev = points.length > 0 ? points[points.length - 1] : undefined;
      targetPulse = prev !== undefined ? prev : currentPulse;
    }

    const scaleY = viewport.getScaleY();
    const trackHeight = viewport.getTrackHeight();
    const currentY = trackHeight - currentPulse * scaleY;
    const targetY = trackHeight - targetPulse * scaleY;
    const deltaY = targetY - currentY;

    cursor.$cursorPulse.set(targetPulse);
    const currentScroll = viewport.$scroll.get();
    viewport.setScroll({ x: currentScroll.x, y: currentScroll.y + deltaY });
  }

  computeZoomScrollOffset(oldZoom: number, newZoom: number): number {
    const size = this.ctx.get(ChartSlice).getChartSize();
    const oldScaleY = BASE_SCALE_Y * oldZoom;
    const newScaleY = BASE_SCALE_Y * newZoom;
    const cursorPulse = this.ctx.get(CursorSlice).$cursorPulse.get();
    const oldScrollTop = this.ctx.get(ViewportSlice).$scroll.get().y;
    const oldTrackHeight = size * oldScaleY;
    const newTrackHeight = size * newScaleY;
    const oldPlayheadY = oldTrackHeight - cursorPulse * oldScaleY - 1;
    const newPlayheadY = newTrackHeight - cursorPulse * newScaleY - 1;
    return oldScrollTop + newPlayheadY - oldPlayheadY;
  }
}
