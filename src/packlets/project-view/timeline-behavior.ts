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
 * - SCALE_Y = 0.2 px/pulse (base scale, zoom multiplier applied later)
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
} from "../scrollable-canvas";
import type { EditorController } from "../editor-core";

const SCALE_Y = 0.2;

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
      labelEl.style.fontFamily = "sans-serif";
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

interface ColumnData {
  title: string;
  scrollTop: number;
  backgroundColor?: string;
  showBorder: boolean;
}

function createColumnRenderer(): (data: unknown) => RenderHandle<ColumnData> {
  return (data: unknown) => {
    const d = data as ColumnData;
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

    // Title, positioned at scrollTop to stay visible while scrolling
    const title = document.createElement("div");
    title.textContent = d.title;
    title.style.position = "absolute";
    title.style.top = `${d.scrollTop}px`;
    title.style.left = "0";
    title.style.width = "100%";
    title.style.textAlign = "center";
    title.style.fontSize = "10px";
    title.style.color = "var(--gray-11)";
    title.style.fontFamily = "sans-serif";
    title.style.pointerEvents = "none";
    el.appendChild(title);

    return {
      dom: el,
      update(newData: unknown) {
        const nd = newData as ColumnData;
        title.style.top = `${nd.scrollTop}px`;
        if (nd.backgroundColor) {
          el.style.backgroundColor = nd.backgroundColor;
        }
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

// ---------------------------------------------------------------------------
// Behavior factory
// ---------------------------------------------------------------------------

export function createTimelineBehaviorFactory(
  controller: EditorController,
): ScrollableCanvasBehaviorFactory {
  const gridLineRenderer = createGridLineRenderer();
  const columnRenderer = createColumnRenderer();
  const trailingBorderRenderer = createTrailingBorderRenderer();

  return (ctx: ScrollableCanvasContext): ScrollableCanvasBehavior => {
    const engine = controller.getTimingEngine();

    const unsub = controller.$selectedChartId.subscribe(() => {
      ctx.refresh();
    });

    return {
      getContentSize() {
        const size = controller.getChartSize();
        return { width: controller.getTimelineWidth(), height: size * SCALE_Y };
      },

      onConnected() {
        const size = controller.getChartSize();
        const height = size * SCALE_Y;
        if (height > ctx.viewportHeight) {
          ctx.setScrollTop(height - ctx.viewportHeight);
        }
      },

      getVisibleObjects(): RenderObject[] {
        const size = controller.getChartSize();
        const height = size * SCALE_Y;
        const viewportTop = ctx.scrollTop;
        const viewportBottom = ctx.scrollTop + ctx.viewportHeight;
        const timelineWidth = controller.getTimelineWidth();
        const columns = controller.getColumns();

        // Convert viewport Y to pulse range.
        const pulseStart = Math.max(0, Math.floor((height - viewportBottom) / SCALE_Y));
        const pulseEnd = Math.min(size, Math.ceil((height - viewportTop) / SCALE_Y));

        const objects: RenderObject[] = [];

        // --- Columns ---
        for (let i = 0; i < columns.length; i++) {
          const col = columns[i]!;
          objects.push({
            key: `column-${col.id}`,
            x: col.x,
            y: 0,
            width: col.width,
            height,
            renderer: columnRenderer,
            data: {
              title: col.title,
              scrollTop: ctx.scrollTop,
              backgroundColor: col.backgroundColor,
              showBorder: i > 0,
            },
            testId: "timeline-column",
          });
        }

        // --- Trailing border after last column ---
        objects.push({
          key: "trailing-border",
          x: timelineWidth - 1,
          y: 0,
          width: 1,
          height,
          renderer: trailingBorderRenderer,
          data: {},
          testId: "trailing-border",
        });

        if (pulseStart >= pulseEnd) return objects;

        // --- Measure lines ---
        const measureBoundaries = engine.getMeasureBoundaries({
          start: pulseStart,
          end: pulseEnd,
        });
        const measureSet = new Set(measureBoundaries);

        const allBoundaries = engine.getMeasureBoundaries({
          start: 0,
          end: pulseEnd,
        });

        for (const pulse of measureBoundaries) {
          const measureIndex = allBoundaries.indexOf(pulse);
          const y = height - pulse * SCALE_Y - 1;
          objects.push({
            key: `measure-${pulse}`,
            x: 0,
            y,
            width: timelineWidth,
            height: 1,
            renderer: gridLineRenderer,
            data: {
              color: "var(--gray-8)",
              label: measureIndex >= 0 ? String(measureIndex + 1) : undefined,
            },
            testId: "measure-line",
          });
        }

        // --- Beat lines (1/4, exclude measure boundaries) ---
        const beatPoints = engine
          .getSnapPoints("1/4", { start: pulseStart, end: pulseEnd })
          .filter((p) => !measureSet.has(p));
        const beatSet = new Set(beatPoints);

        for (const pulse of beatPoints) {
          const y = height - pulse * SCALE_Y - 1;
          objects.push({
            key: `beat-${pulse}`,
            x: 0,
            y,
            width: timelineWidth,
            height: 1,
            renderer: gridLineRenderer,
            data: { color: "var(--gray-7)" },
            testId: "beat-line",
          });
        }

        // --- Snap lines (1/16, exclude measures and beats) ---
        const gridPoints = engine
          .getSnapPoints("1/16", { start: pulseStart, end: pulseEnd })
          .filter((p) => !measureSet.has(p) && !beatSet.has(p));

        for (const pulse of gridPoints) {
          const y = height - pulse * SCALE_Y - 1;
          objects.push({
            key: `grid-${pulse}`,
            x: 0,
            y,
            width: timelineWidth,
            height: 1,
            renderer: gridLineRenderer,
            data: { color: "var(--gray-6)" },
            testId: "snap-line",
          });
        }

        return objects;
      },

      [Symbol.dispose]() {
        unsub();
      },
    };
  };
}
