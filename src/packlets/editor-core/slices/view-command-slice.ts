import { Slice } from "../slice.ts";
import { ZoomSlice } from "./zoom-slice.ts";
import { ViewportSlice } from "./viewport-slice.ts";
import { CursorSlice } from "./cursor-slice.ts";
import { TimingSlice } from "./timing-slice.ts";
import { ChartSlice } from "./chart-slice.ts";
import { SnapSlice } from "./snap-slice.ts";
import { ColumnsSlice } from "./columns-slice.ts";
import { BASE_SCALE_Y, ZOOM_PRESETS } from "../types.ts";

export class ViewCommandSlice extends Slice {
  static readonly sliceKey = "viewCommand";

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
    if (next !== undefined) this.setZoom(next);
  }

  zoomOut(): void {
    const current = this.ctx.get(ZoomSlice).$zoom.get();
    const prev = [...ZOOM_PRESETS].toReversed().find((z) => z < current);
    if (prev !== undefined) this.setZoom(prev);
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
      targetPulse = next ?? currentPulse;
    } else {
      const points = engine.getSnapPoints(snap, { start: 0, end: currentPulse });
      const prev = points.length > 0 ? points.at(-1) : undefined;
      targetPulse = prev ?? currentPulse;
    }

    const scaleY = viewport.getScaleY();
    const trackHeight = viewport.getTrackHeight();
    const currentY = trackHeight - currentPulse * scaleY;
    const targetY = trackHeight - targetPulse * scaleY;
    const deltaY = targetY - currentY;

    cursor.$cursorPulse.set(targetPulse);
    const currentScroll = viewport.$scroll.get();
    viewport.requestScroll({ x: currentScroll.x, y: currentScroll.y + deltaY });
  }

  navigateColumn(direction: "left" | "right"): void {
    const cursor = this.ctx.get(CursorSlice);
    const columns = this.ctx.get(ColumnsSlice).$columns.get();
    const placeable = columns.filter((c) => c.placementHandler);
    if (placeable.length === 0) return;

    const current = cursor.$cursorColumnId.get();
    if (direction === "right") {
      if (current === null) {
        cursor.$cursorColumnId.set(placeable[0].id);
      } else {
        const idx = placeable.findIndex((c) => c.id === current);
        if (idx < placeable.length - 1) {
          cursor.$cursorColumnId.set(placeable[idx + 1].id);
        }
      }
    } else {
      if (current === null) return;
      const idx = placeable.findIndex((c) => c.id === current);
      if (idx > 0) {
        cursor.$cursorColumnId.set(placeable[idx - 1].id);
      }
    }
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
