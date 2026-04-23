/**
 * @packageDocumentation
 *
 * Timeline behavior for ScrollableCanvas. Renders a rhythm-game-style
 * vertical grid: measure lines, beat lines, and snap grid lines.
 *
 * ## Layout
 *
 * - Bottom = start of song (pulse 0)
 * - Top = end of song (pulse = chart size)
 * - SCALE_Y = 0.2 px/pulse (base scale, zoom multiplier applied later)
 * - Full-width horizontal lines spanning the content area
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
const CONTENT_WIDTH = 600;

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

export function createTimelineBehaviorFactory(
  controller: EditorController,
): ScrollableCanvasBehaviorFactory {
  const gridLineRenderer = createGridLineRenderer();

  return (ctx: ScrollableCanvasContext): ScrollableCanvasBehavior => {
    const engine = controller.getTimingEngine();

    const unsub = controller.$selectedChartId.subscribe(() => {
      ctx.refresh();
    });

    return {
      getContentSize() {
        const size = controller.getChartSize();
        return { width: CONTENT_WIDTH, height: size * SCALE_Y };
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

        // Convert viewport Y to pulse range.
        // y = height - pulse * SCALE_Y  =>  pulse = (height - y) / SCALE_Y
        const pulseStart = Math.max(0, Math.floor((height - viewportBottom) / SCALE_Y));
        const pulseEnd = Math.min(size, Math.ceil((height - viewportTop) / SCALE_Y));

        if (pulseStart >= pulseEnd) return [];

        const objects: RenderObject[] = [];

        // --- Measure lines ---
        const measureBoundaries = engine.getMeasureBoundaries({
          start: pulseStart,
          end: pulseEnd,
        });
        const measureSet = new Set(measureBoundaries);

        // Get all boundaries from 0 to compute measure indices.
        const allBoundaries = engine.getMeasureBoundaries({
          start: 0,
          end: pulseEnd,
        });

        for (const pulse of measureBoundaries) {
          const measureIndex = allBoundaries.indexOf(pulse);
          const y = height - pulse * SCALE_Y;
          objects.push({
            key: `measure-${pulse}`,
            x: 0,
            y,
            width: CONTENT_WIDTH,
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
          const y = height - pulse * SCALE_Y;
          objects.push({
            key: `beat-${pulse}`,
            x: 0,
            y,
            width: CONTENT_WIDTH,
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
          const y = height - pulse * SCALE_Y;
          objects.push({
            key: `grid-${pulse}`,
            x: 0,
            y,
            width: CONTENT_WIDTH,
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
