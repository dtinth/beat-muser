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

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

interface GridLineData {
  color: string;
  label?: string;
}

function createGridLineRenderer(): (data: unknown) => RenderHandle<GridLineData> {
  return (data: unknown) => {
    const d = data as GridLineData;
    const el = document.createElement("div");
    el.style.backgroundColor = d.color;

    if (d.label) {
      const labelEl = document.createElement("span");
      labelEl.textContent = d.label;
      labelEl.style.position = "absolute";
      labelEl.style.left = "4px";
      labelEl.style.top = "-7px";
      labelEl.style.fontSize = "10px";
      labelEl.style.color = "var(--gray-11)";
      labelEl.style.fontFamily = "var(--default-font-family)";
      labelEl.style.pointerEvents = "none";
      el.appendChild(labelEl);
    }

    return {
      dom: el,
      update(newData: unknown) {
        const nd = newData as GridLineData;
        el.style.backgroundColor = nd.color;
        const labelEl = el.querySelector("span");
        if (labelEl && nd.label !== undefined) {
          labelEl.textContent = nd.label;
        }
      },
    };
  };
}

interface ColumnBgData {
  backgroundColor?: string;
  showBorder: boolean;
}

function createColumnBgRenderer(): (data: unknown) => RenderHandle<ColumnBgData> {
  return (data: unknown) => {
    const d = data as ColumnBgData;
    const el = document.createElement("div");
    if (d.backgroundColor) {
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
      el.appendChild(border);
    }

    return {
      dom: el,
      update(newData: unknown) {
        const nd = newData as ColumnBgData;
        if (nd.backgroundColor) {
          el.style.backgroundColor = nd.backgroundColor;
        }
      },
    };
  };
}

interface ColumnTitleData {
  title: string;
}

function createColumnTitleRenderer(): (data: unknown) => RenderHandle<ColumnTitleData> {
  return (data: unknown) => {
    const d = data as ColumnTitleData;
    const el = document.createElement("div");
    el.textContent = d.title;
    el.style.display = "flex";
    el.style.alignItems = "center";
    el.style.justifyContent = "center";
    el.style.fontSize = "10px";
    el.style.color = "var(--gray-11)";
    el.style.fontFamily = "var(--default-font-family)";
    el.style.pointerEvents = "none";

    return {
      dom: el,
      update(newData: unknown) {
        const nd = newData as ColumnTitleData;
        el.textContent = nd.title;
      },
    };
  };
}

function createTrailingBorderRenderer(): () => RenderHandle<{}> {
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

function createEventMarkerRenderer(): (data: unknown) => RenderHandle<EventMarkerData> {
  return (data: unknown) => {
    const d = data as EventMarkerData;
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
    if (d.selected) {
      el.style.backgroundColor = "var(--cyan-10)";
      el.style.color = "#000";
    }

    const textEl = document.createElement("span");
    textEl.textContent = d.text;
    el.appendChild(textEl);

    return {
      dom: el,
      update(newData: unknown) {
        const nd = newData as EventMarkerData;
        el.style.backgroundColor = nd.backgroundColor;
        textEl.textContent = nd.text;
        if (nd.selected) {
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

function createPlayheadRenderer(): () => RenderHandle<{}> {
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

function createSelectionBoxRenderer(): () => RenderHandle<{}> {
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

function createColumnCursorRenderer(): (data: unknown) => RenderHandle<{}> {
  return () => {
    const el = document.createElement("div");
    el.style.clipPath = "polygon(50% 0%, 0% 100%, 100% 100%)";
    el.style.backgroundColor = "var(--accent-9)";
    el.style.pointerEvents = "none";
    return { dom: el, update() {} };
  };
}

function createDecorationArrowRenderer(): Renderer {
  return (data: unknown) => {
    const d = data as { angle: number; color: string };
    const el = document.createElement("div");
    el.style.width = "12px";
    el.style.height = "12px";
    el.style.margin = "auto";
    el.style.clipPath = "polygon(50% 0%, 0% 100%, 100% 100%)";
    el.style.backgroundColor = d.color;
    el.style.transform = `rotate(${d.angle - 90}deg)`;
    return {
      dom: el,
      update(newData: unknown) {
        const nd = newData as typeof d;
        el.style.backgroundColor = nd.color;
        el.style.transform = `rotate(${nd.angle - 90}deg)`;
      },
    };
  };
}

function createDecorationLineRenderer(): Renderer {
  return (data: unknown) => {
    const d = data as {
      fromX: number;
      fromY: number;
      toX: number;
      toY: number;
      color: string;
      width: number;
    };
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
    el.appendChild(svg);
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("stroke-linecap", "round");
    line.setAttribute("stroke", d.color);
    line.setAttribute("stroke-width", String(d.width ?? 8));
    svg.appendChild(line);

    const update = (newData: unknown) => {
      const nd = newData as typeof d;
      line.setAttribute("x1", String(nd.fromX));
      line.setAttribute("y1", String(nd.fromY));
      line.setAttribute("x2", String(nd.toX));
      line.setAttribute("y2", String(nd.toY));
    };
    update(d);

    return { dom: el, update };
  };
}

const rendererMap: Record<string, Renderer> = {
  "column-bg": createColumnBgRenderer(),
  "column-title": createColumnTitleRenderer(),
  "trailing-border": createTrailingBorderRenderer(),
  "event-marker": createEventMarkerRenderer(),
  playhead: createPlayheadRenderer(),
  "grid-line": createGridLineRenderer(),
  "selection-box": createSelectionBoxRenderer(),
  waveform: createWaveformRenderer(),
  "column-cursor": createColumnCursorRenderer(),
  "decoration-line": createDecorationLineRenderer(),
  "decoration-arrow": createDecorationArrowRenderer(),
};

function specToRenderObject(spec: TimelineRenderSpec): RenderObject {
  const renderer = rendererMap[spec.type];
  if (!renderer) {
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

    const unsubVisible = controller.$visibleRenderObjects.subscribe(() => {
      ctx.refresh();
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
      },

      getVisibleObjects(): RenderObject[] {
        return controller.$visibleRenderObjects.get().map(specToRenderObject);
      },

      [Symbol.dispose]() {
        unsubOutbox();
        unsubVisible();
      },
    };
  };
}
