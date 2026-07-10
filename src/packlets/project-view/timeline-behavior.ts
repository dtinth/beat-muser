/**
 * @packageDocumentation
 *
 * Timeline behavior for ScrollableCanvas. Renders a rhythm-game-style
 * vertical grid with columns for measures, time signatures, BPM changes,
 * and (in the future) gameplay lanes.
 *
 * ## Layout
 *
 * - Bottom = start of song (pulse 0)
 * - Top = end of song (pulse = chart size)
 - Scale Y = 0.2 px/pulse at 100% zoom, multiplied by zoom level from EditorController
 * - Columns are defined by the EditorController and stacked left-to-right
 * - Horizontal grid lines span the entire timeline width across all columns
 *
 * ## Grid levels
 *
 * - **Measure lines** — thick, labeled with 1-based measure number
 * - **Beat lines** (1/4) — medium opacity
 * - **Snap lines** (1/16) — very light, only visible when zoomed in enough
 */

import type {
  ScrollableCanvasBehavior,
  ScrollableCanvasBehaviorFactory,
  ScrollableCanvasContext,
  RenderObject,
  RenderHandle,
  Renderer,
} from "../scrollable-canvas/index.tsx";
import type { EditorController, TimelineRenderSpec } from "../editor-core/index.ts";
import { createWaveformRenderer } from "./waveform-renderer.ts";
import { setProfilerTarget } from "../perf/profiler-registry.ts";

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

interface GridLineData {
  color: string;
  label?: string;
}

function createGridLineRenderer(): Renderer<GridLineData> {
  return (d: GridLineData) => {
    const el = document.createElement("div");
    el.style.backgroundColor = d.color;

    // Always create the label element; show/hide via textContent
    const labelEl = document.createElement("span");
    labelEl.style.position = "absolute";
    labelEl.style.left = "4px";
    labelEl.style.top = "-7px";
    labelEl.style.fontSize = "10px";
    labelEl.style.color = "var(--gray-11)";
    labelEl.style.fontFamily = "var(--default-font-family)";
    labelEl.style.pointerEvents = "none";
    if (d.label !== undefined && d.label !== "") {
      labelEl.textContent = d.label;
      el.append(labelEl);
    }

    let last = d;

    return {
      dom: el,
      update(nd: GridLineData) {
        if (nd.color === last.color && nd.label === last.label) return;
        last = nd;
        el.style.backgroundColor = nd.color;
        if (nd.label === undefined) {
          labelEl.textContent = "";
        } else {
          labelEl.textContent = nd.label;
          if (labelEl.parentNode === null) el.append(labelEl);
        }
      },
    };
  };
}

interface ColumnBgData {
  backgroundColor?: string;
  showBorder: boolean;
}

function createColumnBgRenderer(): Renderer<ColumnBgData> {
  return (d: ColumnBgData) => {
    const el = document.createElement("div");
    if (d.backgroundColor !== undefined && d.backgroundColor !== "") {
      el.style.backgroundColor = d.backgroundColor;
    }

    // Left border (skip for first column)
    if (d.showBorder) {
      const border = document.createElement("div");
      border.style.position = "absolute";
      border.style.left = "0";
      border.style.top = "0";
      border.style.bottom = "0";
      border.style.width = "1px";
      border.style.backgroundColor = "var(--gray-5)";
      el.append(border);
    }

    let last = d;

    return {
      dom: el,
      update(nd: ColumnBgData) {
        if (nd.backgroundColor === last.backgroundColor && nd.showBorder === last.showBorder)
          return;
        last = nd;
        if (nd.backgroundColor !== undefined && nd.backgroundColor !== "") {
          el.style.backgroundColor = nd.backgroundColor;
        }
      },
    };
  };
}

interface ColumnTitleData {
  title: string;
}

function createColumnTitleRenderer(): Renderer<ColumnTitleData> {
  return (d: ColumnTitleData) => {
    const el = document.createElement("div");
    el.textContent = d.title;
    el.style.display = "flex";
    el.style.alignItems = "center";
    el.style.justifyContent = "center";
    el.style.fontSize = "10px";
    el.style.color = "var(--gray-11)";
    el.style.fontFamily = "var(--default-font-family)";
    el.style.pointerEvents = "none";

    let last = d;

    return {
      dom: el,
      update(nd: ColumnTitleData) {
        if (nd.title === last.title) return;
        last = nd;
        el.textContent = nd.title;
      },
    };
  };
}

function createTrailingBorderRenderer(): () => RenderHandle {
  return () => {
    const el = document.createElement("div");
    el.style.backgroundColor = "var(--gray-5)";
    return {
      dom: el,
      update() {},
    };
  };
}

interface EventMarkerData {
  text: string;
  backgroundColor: string;
  textColor: string;
  selected?: boolean;
}

function createEventMarkerRenderer(): Renderer<EventMarkerData> {
  return (d: EventMarkerData) => {
    const el = document.createElement("div");
    el.style.backgroundColor = d.backgroundColor;
    el.style.color = d.textColor;
    el.style.fontSize = "10px";
    el.style.fontWeight = "600";
    el.style.fontFamily = "var(--default-font-family)";
    el.style.display = "flex";
    el.style.alignItems = "center";
    el.style.justifyContent = "center";
    el.style.boxShadow = "inset 1px 1px 0 #fff5, inset -1px -1px 0 #0005";
    el.style.pointerEvents = "auto";
    if (d.selected === true) {
      el.style.backgroundColor = "var(--cyan-10)";
      el.style.color = "#000";
    }

    const textEl = document.createElement("span");
    textEl.textContent = d.text;
    el.append(textEl);

    let last = d;

    return {
      dom: el,
      update(nd: EventMarkerData) {
        if (
          nd.text === last.text &&
          nd.backgroundColor === last.backgroundColor &&
          nd.textColor === last.textColor &&
          nd.selected === last.selected
        )
          return;
        last = nd;
        textEl.textContent = nd.text;
        if (nd.selected === true) {
          el.style.backgroundColor = "var(--cyan-10)";
          el.style.color = "#000";
        } else {
          el.style.backgroundColor = nd.backgroundColor;
          el.style.color = nd.textColor;
        }
      },
    };
  };
}

function createPlayheadRenderer(): () => RenderHandle {
  return () => {
    const el = document.createElement("div");
    el.style.backgroundColor = "var(--accent-9)";
    el.style.pointerEvents = "none";
    return {
      dom: el,
      update() {},
    };
  };
}

// ---------------------------------------------------------------------------
// Behavior factory
// ---------------------------------------------------------------------------

function createSelectionBoxRenderer(): () => RenderHandle {
  return () => {
    const el = document.createElement("div");
    el.style.backgroundColor = "rgba(159, 238, 42, 0.15)";
    el.style.border = "1px dashed rgba(159, 238, 42, 0.6)";
    el.style.pointerEvents = "none";
    return {
      dom: el,
      update() {},
    };
  };
}

function createColumnCursorRenderer(): (data: unknown) => RenderHandle {
  return () => {
    const el = document.createElement("div");
    el.style.clipPath = "polygon(50% 0%, 0% 100%, 100% 100%)";
    el.style.backgroundColor = "var(--accent-9)";
    el.style.pointerEvents = "none";
    return { dom: el, update() {} };
  };
}

function createOverlapIndicatorRenderer(): () => RenderHandle {
  return () => {
    const el = document.createElement("div");
    // A warning ring drawn over a cell that holds 2+ stacked entities. Sits
    // above the markers (higher zIndex) but never intercepts pointer events so
    // the entities underneath stay clickable.
    el.style.boxSizing = "border-box";
    el.style.border = "2px solid var(--red-9)";
    el.style.borderRadius = "3px";
    el.style.boxShadow = "0 0 0 1px var(--red-a6), 0 0 5px var(--red-9)";
    el.style.pointerEvents = "none";
    return { dom: el, update() {} };
  };
}

interface DecorationArrowData {
  angle: number;
  color: string;
}

function createDecorationArrowRenderer(): Renderer<DecorationArrowData> {
  return (d: DecorationArrowData) => {
    const el = document.createElement("div");
    el.style.width = "12px";
    el.style.height = "12px";
    el.style.margin = "auto";
    // Triangle points up at 0°; rotate so 0° angle→right, 90°→up
    el.style.clipPath = "polygon(50% 0%, 0% 100%, 100% 100%)";
    el.style.backgroundColor = d.color;
    const safeAngle = Number.isFinite(d.angle) ? d.angle : 0;
    el.style.transform = `rotate(${90 - safeAngle}deg)`;
    let last = d;
    return {
      dom: el,
      update(nd: DecorationArrowData) {
        if (nd.color === last.color && nd.angle === last.angle) return;
        last = nd;
        el.style.backgroundColor = nd.color;
        const a = Number.isFinite(nd.angle) ? nd.angle : 0;
        el.style.transform = `rotate(${90 - a}deg)`;
      },
    };
  };
}

interface DecorationLineData {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  color: string;
  width: number;
  cp1x?: number;
  cp1y?: number;
  cp2x?: number;
  cp2y?: number;
}

function createDecorationLineRenderer(): Renderer<DecorationLineData> {
  return (d: DecorationLineData) => {
    const el = document.createElement("div");
    el.style.position = "absolute";
    el.style.top = "0";
    el.style.left = "0";
    el.style.width = "100%";
    el.style.height = "100%";
    el.style.overflow = "visible";
    el.style.pointerEvents = "none";
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("overflow", "visible");
    svg.style.display = "block";
    svg.style.width = "100%";
    svg.style.height = "100%";
    el.append(svg);
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke", d.color);
    path.setAttribute("stroke-width", String(d.width ?? 8));
    svg.append(path);

    function setPath(nd: DecorationLineData) {
      if (nd.cp1x !== undefined && nd.cp2x !== undefined) {
        path.setAttribute(
          "d",
          `M${nd.fromX},${nd.fromY} C${nd.cp1x},${nd.cp1y} ${nd.cp2x},${nd.cp2y} ${nd.toX},${nd.toY}`,
        );
      } else {
        path.setAttribute("d", `M${nd.fromX},${nd.fromY} L${nd.toX},${nd.toY}`);
      }
    }

    const update = (nd: DecorationLineData) => {
      setPath(nd);
    };
    setPath(d);
    return { dom: el, update };
  };
}

// Fixed set of zigzag turning points (as fractions of width/height) tracing a
// single diagonal "lightning bolt" from top-left-ish to bottom-right-ish.
const RECT_ZIGZAG_POINTS: readonly [number, number][] = [
  [0.5, 0],
  [0.2, 0.25],
  [0.7, 0.5],
  [0.3, 0.75],
  [0.5, 1],
];

interface DecorationRectData {
  color: string;
}

function createDecorationRectRenderer(): Renderer<DecorationRectData> {
  return (d: DecorationRectData) => {
    const el = document.createElement("div");
    el.style.boxSizing = "border-box";
    el.style.width = "100%";
    el.style.height = "100%";
    el.style.pointerEvents = "none";
    el.style.position = "relative";
    el.style.border = `2px solid ${d.color}`;

    // A 0–100 viewBox with preserveAspectRatio="none" lets the zigzag points
    // be plain percentages of the box, so it always fills whatever size the
    // render object currently has without needing to read (possibly stale)
    // layout dimensions from the DOM.
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.style.position = "absolute";
    svg.style.top = "0";
    svg.style.left = "0";
    svg.style.display = "block";
    svg.style.width = "100%";
    svg.style.height = "100%";
    el.append(svg);

    const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    polyline.setAttribute(
      "points",
      RECT_ZIGZAG_POINTS.map(([fx, fy]) => `${fx * 100},${fy * 100}`).join(" "),
    );
    polyline.setAttribute("fill", "none");
    polyline.setAttribute("stroke-linecap", "round");
    polyline.setAttribute("stroke-linejoin", "round");
    polyline.setAttribute("vector-effect", "non-scaling-stroke");
    polyline.setAttribute("stroke-width", "3");
    svg.append(polyline);

    function setStyle(nd: DecorationRectData) {
      el.style.border = `2px solid ${nd.color}`;
      polyline.setAttribute("stroke", nd.color);
    }

    let last = d;
    setStyle(d);

    return {
      dom: el,
      update(nd: DecorationRectData) {
        if (nd.color === last.color) return;
        last = nd;
        setStyle(nd);
      },
    };
  };
}

function createDecorationMarkerRenderer(): Renderer {
  return () => {
    const el = document.createElement("div");
    // Same visual language as the core overlap indicator's warning ring.
    el.style.boxSizing = "border-box";
    el.style.width = "100%";
    el.style.height = "100%";
    el.style.border = "2px solid var(--red-9)";
    el.style.borderRadius = "3px";
    el.style.boxShadow = "0 0 0 1px var(--red-a6), 0 0 5px var(--red-9)";
    el.style.pointerEvents = "none";
    return { dom: el, update() {} };
  };
}

// The registry bridges strongly-typed renderers (each expecting its own data
// shape) to the canvas's untyped `Renderer` contract. The per-type data shape
// is guaranteed by the EditorController that emits matching `type`+`data`
// pairs, so `Renderer<any>` is the deliberate join point for that erasure.
const rendererMap: Record<string, Renderer<any>> = {
  "column-bg": createColumnBgRenderer(),
  "column-title": createColumnTitleRenderer(),
  "trailing-border": createTrailingBorderRenderer(),
  "event-marker": createEventMarkerRenderer(),
  playhead: createPlayheadRenderer(),
  "grid-line": createGridLineRenderer(),
  "selection-box": createSelectionBoxRenderer(),
  waveform: createWaveformRenderer(),
  "column-cursor": createColumnCursorRenderer(),
  "overlap-indicator": createOverlapIndicatorRenderer(),
  "decoration-line": createDecorationLineRenderer(),
  "decoration-arrow": createDecorationArrowRenderer(),
  "decoration-rect": createDecorationRectRenderer(),
  "decoration-marker": createDecorationMarkerRenderer(),
};

function specToRenderObject(spec: TimelineRenderSpec): RenderObject {
  const renderer = rendererMap[spec.type] as Renderer<any> | undefined;
  if (renderer === undefined) {
    throw new Error(`Unknown render spec type: ${spec.type}`);
  }
  return {
    key: spec.key,
    x: spec.x,
    y: spec.y,
    width: spec.width,
    height: spec.height,
    renderer,
    data: spec.data,
    testId: spec.testId,
    layer: spec.layer,
    zIndex: spec.zIndex,
    opacity: spec.opacity,
  };
}

export function createTimelineBehaviorFactory(
  controller: EditorController,
): ScrollableCanvasBehaviorFactory {
  return (ctx: ScrollableCanvasContext): ScrollableCanvasBehavior => {
    controller.setViewportSize(ctx.viewportWidth, ctx.viewportHeight);

    const unsubOutbox = controller.outbox.on("setScroll", (point) => {
      ctx.setScroll(point);
    });

    const unsubVisible = controller.onRenderRequested(() => {
      ctx.refresh();
    });

    // Register the profiler target so the Debug tab and Playwright script can
    // run a render profile against the live canvas without importing editor code.
    const unregisterProfilerTarget = setProfilerTarget({
      setScroll(point) {
        ctx.setScroll(point);
      },
      getScrollInfo() {
        return {
          scrollTop: ctx.scrollTop,
          scrollLeft: ctx.scrollLeft,
          viewportWidth: ctx.viewportWidth,
          viewportHeight: ctx.viewportHeight,
          contentHeight: controller.getContentHeight(),
        };
      },
      getDomNodeCount() {
        // Count children of the scroll layer (visible DOM nodes).
        const layer = document.querySelector<HTMLElement>('[data-testid="scroll-layer"]');
        return layer ? layer.childElementCount : 0;
      },
    });

    return {
      getContentSize() {
        return {
          width: controller.getTimelineWidth(),
          height: controller.getContentHeight(),
        };
      },

      onConnected() {
        controller.setViewportSize(ctx.viewportWidth, ctx.viewportHeight);
        controller.onConnected();
      },

      onScroll(
        scrollLeft: number,
        scrollTop: number,
        viewportWidth: number,
        viewportHeight: number,
      ) {
        controller.setViewportSize(viewportWidth, viewportHeight);
        controller.setScroll({ x: scrollLeft, y: scrollTop });
      },

      onPointerEvent(event, contentX, contentY) {
        const viewportX = contentX - ctx.scrollLeft;
        const viewportY = contentY - ctx.scrollTop;
        if (event.type === "pointermove") {
          controller.handlePointerMove(viewportX, viewportY);
        }
        if (event.type === "pointerdown") {
          controller.handlePointerDown({ x: viewportX, y: viewportY }, event.shiftKey);
        }
        if (event.type === "pointerup") {
          controller.handlePointerUp();
        }
        if (event.type === "pointercancel") {
          controller.handlePointerCancel();
        }
      },

      getVisibleObjects(): RenderObject[] {
        return controller.getVisibleRenderObjects().map((spec) => specToRenderObject(spec));
      },

      [Symbol.dispose]() {
        unsubOutbox();
        unsubVisible();
        unregisterProfilerTarget();
      },
    };
  };
}
