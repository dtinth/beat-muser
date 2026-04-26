import { atom } from "nanostores";
import { createNanoEvents } from "nanoevents";
import { Slice } from "../slice";
import { ZoomSlice } from "./zoom-slice";
import { ChartSlice } from "./chart-slice";
import { Point, type Dimension } from "../../geometry";
import { BASE_SCALE_Y, PADDING_BOTTOM } from "../types";

export class ViewportSlice extends Slice {
  static readonly sliceKey = "viewport";

  $scroll = atom<Point>({ x: 0, y: 0 });
  $viewportSize = atom<Dimension>({ width: 0, height: 0 });
  private events = createNanoEvents<{ viewportChanged: () => void }>();

  setScroll(point: Point): void {
    this.$scroll.set(point);
    this.events.emit("viewportChanged");
  }

  setViewportSize(width: number, height: number): void {
    this.$viewportSize.set({ width, height });
    this.events.emit("viewportChanged");
  }

  onViewportChanged(cb: () => void): () => void {
    return this.events.on("viewportChanged", cb);
  }

  getScaleY(): number {
    return BASE_SCALE_Y * this.ctx.get(ZoomSlice).$zoom.get();
  }

  getTrackHeight(): number {
    return this.ctx.get(ChartSlice).getChartSize() * this.getScaleY();
  }

  getContentHeight(): number {
    return this.getTrackHeight() + PADDING_BOTTOM;
  }

  getVisiblePulseRange(): {
    start: number;
    end: number;
    rawStart: number;
    rawEnd: number;
  } {
    const size = this.ctx.get(ChartSlice).getChartSize();
    const scaleY = this.getScaleY();
    const trackHeight = this.getTrackHeight();
    const scrollTop = this.$scroll.get().y;
    const viewportHeight = this.$viewportSize.get().height;
    const viewportBottom = scrollTop + viewportHeight;

    const rawPulseStart = Math.max(0, Math.floor((trackHeight - viewportBottom) / scaleY));
    const rawPulseEnd = Math.min(size, Math.ceil((trackHeight - scrollTop) / scaleY));
    return {
      start: Math.max(0, rawPulseStart - 50),
      end: Math.min(size, rawPulseEnd + 50),
      rawStart: rawPulseStart,
      rawEnd: rawPulseEnd,
    };
  }
}
