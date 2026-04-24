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
import { BPM_CHANGE, TIME_SIGNATURE, EVENT } from "../editor-core";

const SCALE_Y = 0.2;
const PADDING_BOTTOM = 40;

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

    const textEl = document.createElement("span");
    textEl.textContent = d.text;
    el.appendChild(textEl);

    return {
      dom: el,
      update(newData: unknown) {
        const nd = newData as EventMarkerData;
        el.style.backgroundColor = nd.backgroundColor;
        textEl.textContent = nd.text;
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

export function createTimelineBehaviorFactory(
  controller: EditorController,
): ScrollableCanvasBehaviorFactory {
  const gridLineRenderer = createGridLineRenderer();
  const columnBgRenderer = createColumnBgRenderer();
  const columnTitleRenderer = createColumnTitleRenderer();
  const trailingBorderRenderer = createTrailingBorderRenderer();
  const eventMarkerRenderer = createEventMarkerRenderer();
  const playheadRenderer = createPlayheadRenderer();

  return (ctx: ScrollableCanvasContext): ScrollableCanvasBehavior => {
    const engine = controller.getTimingEngine();

    const unsub = controller.$selectedChartId.subscribe(() => {
      ctx.refresh();
    });

    return {
      getContentSize() {
        const size = controller.getChartSize();
        return {
          width: controller.getTimelineWidth(),
          height: size * SCALE_Y + PADDING_BOTTOM,
        };
      },

      onConnected() {
        const size = controller.getChartSize();
        const height = size * SCALE_Y + PADDING_BOTTOM;
        if (height > ctx.viewportHeight) {
          ctx.setScrollTop(height - ctx.viewportHeight);
        }
      },

      onPointerEvent(_event, _contentX, contentY) {
        const size = controller.getChartSize();
        const height = size * SCALE_Y + PADDING_BOTTOM;
        const rawPulse = (height - contentY) / SCALE_Y;
        const snappedPulse = controller.snapToGrid(rawPulse);
        controller.$cursorPulse.set(snappedPulse);
        ctx.refresh();
      },

      getVisibleObjects(): RenderObject[] {
        const size = controller.getChartSize();
        const height = size * SCALE_Y + PADDING_BOTTOM;
        const viewportTop = ctx.scrollTop;
        const viewportBottom = ctx.scrollTop + ctx.viewportHeight;
        const timelineWidth = controller.getTimelineWidth();
        const columns = controller.getColumns();

        // Convert viewport Y to pulse range. Expand slightly so event
        // markers just outside the viewport edge are still rendered.
        const rawPulseStart = Math.max(0, Math.floor((height - viewportBottom) / SCALE_Y));
        const rawPulseEnd = Math.min(size, Math.ceil((height - viewportTop) / SCALE_Y));
        const pulseStart = Math.max(0, rawPulseStart - 50);
        const pulseEnd = Math.min(size, rawPulseEnd + 50);

        const objects: RenderObject[] = [];

        // --- Column backgrounds (scroll layer) ---
        for (let i = 0; i < columns.length; i++) {
          const col = columns[i]!;
          objects.push({
            key: `column-bg-${col.id}`,
            x: col.x,
            y: 0,
            width: col.width,
            height,
            renderer: columnBgRenderer,
            data: {
              backgroundColor: col.backgroundColor,
              showBorder: i > 0,
            },
            testId: "timeline-column-bg",
          });
        }

        // --- Column titles (sticky layer) ---
        for (const col of columns) {
          objects.push({
            key: `column-title-${col.id}`,
            x: col.x,
            y: 4,
            width: col.width,
            height: 16,
            layer: "sticky",
            renderer: columnTitleRenderer,
            data: { title: col.title },
            testId: "timeline-column-title",
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

        // --- Timing event markers ---
        const entityManager = controller.getEntityManager();
        const bpmColumn = columns.find((c) => c.id === "bpm");
        const tsColumn = columns.find((c) => c.id === "time-sig");

        if (bpmColumn) {
          for (const entity of entityManager.entitiesWithComponent(BPM_CHANGE)) {
            const event = entityManager.getComponent(entity, EVENT);
            const bpm = entityManager.getComponent(entity, BPM_CHANGE);
            if (!event || !bpm) continue;
            const pulse = event.y;
            if (pulse < pulseStart || pulse >= pulseEnd) continue;

            objects.push({
              key: `bpm-${entity.id}`,
              x: bpmColumn.x,
              y: height - pulse * SCALE_Y - 14,
              width: bpmColumn.width,
              height: 14,
              renderer: eventMarkerRenderer,
              data: {
                text: String(bpm.bpm),
                backgroundColor: "var(--yellow-6)",
                textColor: "#fff",
              },
              testId: "bpm-change-marker",
            });
          }
        }

        if (tsColumn) {
          for (const entity of entityManager.entitiesWithComponent(TIME_SIGNATURE)) {
            const event = entityManager.getComponent(entity, EVENT);
            const ts = entityManager.getComponent(entity, TIME_SIGNATURE);
            if (!event || !ts) continue;
            const pulse = event.y;
            if (pulse < pulseStart || pulse >= pulseEnd) continue;

            objects.push({
              key: `ts-${entity.id}`,
              x: tsColumn.x,
              y: height - pulse * SCALE_Y - 14,
              width: tsColumn.width,
              height: 14,
              renderer: eventMarkerRenderer,
              data: {
                text: `${ts.numerator}/${ts.denominator}`,
                backgroundColor: "var(--tomato-6)",
                textColor: "#fff",
              },
              testId: "time-sig-marker",
            });
          }
        }

        // --- Playhead ---
        const cursorPulse = controller.$cursorPulse.get();
        if (cursorPulse >= 0 && cursorPulse <= size) {
          objects.push({
            key: "playhead",
            x: 0,
            y: height - cursorPulse * SCALE_Y - 1,
            width: timelineWidth,
            height: 1,
            renderer: playheadRenderer,
            data: {},
            testId: "playhead",
          });
        }

        if (rawPulseStart >= rawPulseEnd) return objects;

        // --- Measure lines ---
        const measureBoundaries = engine.getMeasureBoundaries({
          start: rawPulseStart,
          end: rawPulseEnd,
        });
        const measureSet = new Set(measureBoundaries);

        const allBoundaries = engine.getMeasureBoundaries({
          start: 0,
          end: rawPulseEnd,
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
          .getSnapPoints("1/4", { start: rawPulseStart, end: rawPulseEnd })
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
          .getSnapPoints("1/16", { start: rawPulseStart, end: rawPulseEnd })
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
