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
} from "../scrollable-canvas";
import type { EditorController, TimelineRenderSpec } from "../editor-core";

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
    el.style.zIndex = "2";
    return {
      dom: el,
      update() {},
    };
  };
}

// ---------------------------------------------------------------------------
// Behavior factory
// ---------------------------------------------------------------------------

const rendererMap: Record<string, Renderer> = {
  "column-bg": createColumnBgRenderer(),
  "column-title": createColumnTitleRenderer(),
  "trailing-border": createTrailingBorderRenderer(),
  "event-marker": createEventMarkerRenderer(),
  playhead: createPlayheadRenderer(),
  "grid-line": createGridLineRenderer(),
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
  };
}

export function createTimelineBehaviorFactory(
  controller: EditorController,
): ScrollableCanvasBehaviorFactory {
  return (ctx: ScrollableCanvasContext): ScrollableCanvasBehavior => {
    controller.setViewportSize(ctx.viewportWidth, ctx.viewportHeight);

    const unsubOutbox = controller.outbox.on("setScrollTop", (top) => {
      ctx.setScrollTop(top);
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

      onScroll(scrollLeft: number, scrollTop: number) {
        controller.setScrollLeft(scrollLeft);
        controller.setScrollTop(scrollTop);
      },

      onPointerEvent(event, contentX, contentY) {
        const viewportX = contentX - ctx.scrollLeft;
        const viewportY = contentY - ctx.scrollTop;
        if (event.type === "pointermove") {
          controller.setCursor(viewportX, viewportY);
        }
        if (event.type === "pointerdown") {
          controller.handlePointerDown({ x: viewportX, y: viewportY });
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
