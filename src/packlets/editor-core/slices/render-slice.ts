import { atom } from "nanostores";
import { Slice } from "../slice";
import type { EditorContext } from "../editor-context";
import { ProjectSlice } from "./project-slice";
import { ChartSlice } from "./chart-slice";
import { ViewportSlice } from "./viewport-slice";
import { ColumnsSlice } from "./columns-slice";
import { SelectionSlice } from "./selection-slice";
import { BoxSelectionSlice } from "./box-selection-slice";
import { CursorSlice } from "./cursor-slice";
import { SnapSlice } from "./snap-slice";
import { TimingSlice } from "./timing-slice";
import {
  EVENT,
  NOTE,
  LEVEL_REF,
  BPM_CHANGE,
  TIME_SIGNATURE,
  CHART_REF,
  SOUND_EVENT,
  SOUND_CHANNEL,
} from "../components";
import type { TimelineRenderSpec } from "../types";

export class RenderSlice extends Slice {
  static readonly sliceKey = "render";

  $visibleRenderObjects = atom<TimelineRenderSpec[]>([]);

  constructor(ctx: EditorContext) {
    super(ctx);
    ctx.get(ProjectSlice).entityManager.$mutationVersion.subscribe(() => {
      this.refresh();
    });
    ctx.get(SelectionSlice).$selection.subscribe(() => {
      this.refresh();
    });
    ctx.get(CursorSlice).$cursorPulse.subscribe(() => {
      this.refresh();
    });
    ctx.get(CursorSlice).$cursorViewportPos.subscribe(() => {
      this.refresh();
    });
  }

  refresh(): void {
    this.$visibleRenderObjects.set(this.computeSpecs());
  }

  private computeSpecs(): TimelineRenderSpec[] {
    const chartSlice = this.ctx.get(ChartSlice);
    const viewport = this.ctx.get(ViewportSlice);
    const columnsSlice = this.ctx.get(ColumnsSlice);
    const selection = this.ctx.get(SelectionSlice);
    const boxSelection = this.ctx.get(BoxSelectionSlice);
    const cursor = this.ctx.get(CursorSlice);
    const snapSlice = this.ctx.get(SnapSlice);
    const timing = this.ctx.get(TimingSlice);
    const entityManager = this.ctx.get(ProjectSlice).entityManager;

    const size = chartSlice.getChartSize();
    const scaleY = viewport.getScaleY();
    const trackHeight = viewport.getTrackHeight();
    const contentHeight = viewport.getContentHeight();
    const pulseRange = viewport.getVisiblePulseRange();
    const pulseStart = pulseRange.start;
    const pulseEnd = pulseRange.end;
    const rawPulseStart = pulseRange.rawStart;
    const rawPulseEnd = pulseRange.rawEnd;
    const timelineWidth = columnsSlice.$timelineWidth.get();
    const columns = columnsSlice.$columns.get();

    const specs: TimelineRenderSpec[] = [];

    // --- Column backgrounds (scroll layer) ---
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i]!;
      specs.push({
        key: `column-bg-${col.id}`,
        type: "column-bg",
        x: col.x,
        y: 0,
        width: col.width,
        height: contentHeight,
        data: { backgroundColor: col.backgroundColor, showBorder: i > 0 },
        testId: "timeline-column-bg",
      });
    }

    // --- Column titles (sticky layer) ---
    for (const col of columns) {
      specs.push({
        key: `column-title-${col.id}`,
        type: "column-title",
        x: col.x,
        y: 4,
        width: col.width,
        height: 16,
        layer: "sticky",
        data: { title: col.title },
        testId: "timeline-column-title",
      });
    }

    // --- Trailing border after last column ---
    specs.push({
      key: "trailing-border",
      type: "trailing-border",
      x: timelineWidth - 1,
      y: 0,
      width: 1,
      height: contentHeight,
      data: {},
      testId: "trailing-border",
    });

    // --- Gameplay notes ---
    for (const entity of entityManager.entitiesWithComponent(NOTE)) {
      const event = entityManager.getComponent(entity, EVENT);
      const note = entityManager.getComponent(entity, NOTE);
      const levelRef = entityManager.getComponent(entity, LEVEL_REF);
      if (!event || !note || !levelRef) continue;

      const pulse = event.y;
      if (pulse < pulseStart || pulse >= pulseEnd) continue;

      const laneCol = columns.find(
        (c) => c.levelId === levelRef.levelId && c.laneIndex === note.lane,
      );
      if (!laneCol) continue;

      const colIndex = columns.indexOf(laneCol);
      specs.push({
        key: `note-${entity.id}`,
        type: "event-marker",
        x: laneCol.x,
        y: trackHeight - pulse * scaleY - 14,
        width: laneCol.width,
        height: 14,
        data: {
          text: "",
          backgroundColor: laneCol.noteColor ?? "var(--accent-9)",
          textColor: "#fff",
          selected:
            selection.$selection.get().has(entity.id) || boxSelection.isInBox(pulse, colIndex),
        },
        testId: "note",
        entityId: entity.id,
      });
    }

    // --- Timing event markers ---
    const bpmColumn = columns.find((c) => c.id === "bpm");
    const tsColumn = columns.find((c) => c.id === "time-sig");
    const bpmColIndex = bpmColumn ? columns.indexOf(bpmColumn) : -1;
    const tsColIndex = tsColumn ? columns.indexOf(tsColumn) : -1;

    if (bpmColumn) {
      for (const entity of entityManager.entitiesWithComponent(BPM_CHANGE)) {
        const event = entityManager.getComponent(entity, EVENT);
        const bpm = entityManager.getComponent(entity, BPM_CHANGE);
        if (!event || !bpm) continue;
        const pulse = event.y;
        if (pulse < pulseStart || pulse >= pulseEnd) continue;

        specs.push({
          key: `bpm-${entity.id}`,
          type: "event-marker",
          x: bpmColumn.x,
          y: trackHeight - pulse * scaleY - 14,
          width: bpmColumn.width,
          height: 14,
          data: {
            text: String(bpm.bpm),
            backgroundColor: "var(--yellow-6)",
            textColor: "#fff",
            selected:
              selection.$selection.get().has(entity.id) || boxSelection.isInBox(pulse, bpmColIndex),
          },
          testId: "bpm-change-marker",
          entityId: entity.id,
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

        specs.push({
          key: `ts-${entity.id}`,
          type: "event-marker",
          x: tsColumn.x,
          y: trackHeight - pulse * scaleY - 14,
          width: tsColumn.width,
          height: 14,
          data: {
            text: `${ts.numerator}/${ts.denominator}`,
            backgroundColor: "var(--tomato-6)",
            textColor: "#fff",
            selected:
              selection.$selection.get().has(entity.id) || boxSelection.isInBox(pulse, tsColIndex),
          },
          testId: "time-sig-marker",
          entityId: entity.id,
        });
      }
    }

    // --- Sound events ---
    const selectedChartId = chartSlice.$selectedChartId.get();
    for (const entity of entityManager.entitiesWithComponent(SOUND_EVENT)) {
      const event = entityManager.getComponent(entity, EVENT);
      const soundEvent = entityManager.getComponent(entity, SOUND_EVENT);
      const chartRef = entityManager.getComponent(entity, CHART_REF);
      if (!event || !soundEvent || !chartRef || chartRef.chartId !== selectedChartId) continue;

      const pulse = event.y;
      if (pulse < pulseStart || pulse >= pulseEnd) continue;

      const soundLaneCol = columns.find((c) => c.soundLane === soundEvent.soundLane);
      if (!soundLaneCol) continue;

      const colIndex = columns.indexOf(soundLaneCol);
      const soundChannel = entityManager.get(soundEvent.soundChannelId);
      const soundChannelName = soundChannel
        ? (entityManager.getComponent(soundChannel, SOUND_CHANNEL)?.name ?? "?")
        : "?";

      specs.push({
        key: `sound-${entity.id}`,
        type: "event-marker",
        x: soundLaneCol.x,
        y: trackHeight - pulse * scaleY - 14,
        width: soundLaneCol.width,
        height: 14,
        data: {
          text: `${soundChannelName} [${soundEvent.command}]`,
          backgroundColor: "var(--blue-6)",
          textColor: "#fff",
          selected:
            selection.$selection.get().has(entity.id) || boxSelection.isInBox(pulse, colIndex),
        },
        testId: "sound-event-marker",
        entityId: entity.id,
      });
    }

    // --- Playhead ---
    const cursorPulse = cursor.$cursorPulse.get();
    if (cursorPulse >= 0 && cursorPulse <= size) {
      specs.push({
        key: "playhead",
        type: "playhead",
        x: 0,
        y: trackHeight - cursorPulse * scaleY - 1,
        width: timelineWidth,
        height: 1,
        data: {},
        testId: "playhead",
      });
    }

    if (rawPulseStart >= rawPulseEnd) return specs;

    // --- Measure lines ---
    const engine = timing.getTimingEngine();
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
      specs.push({
        key: `measure-${pulse}`,
        type: "grid-line",
        x: 0,
        y: trackHeight - pulse * scaleY - 1,
        width: timelineWidth,
        height: 1,
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
      specs.push({
        key: `beat-${pulse}`,
        type: "grid-line",
        x: 0,
        y: trackHeight - pulse * scaleY - 1,
        width: timelineWidth,
        height: 1,
        data: { color: "var(--gray-7)" },
        testId: "beat-line",
      });
    }

    // --- Snap lines at current snap resolution (exclude measures and beats) ---
    const snap = snapSlice.$snap.get();
    const gridPoints = engine
      .getSnapPoints(snap, { start: rawPulseStart, end: rawPulseEnd })
      .filter((p) => !measureSet.has(p) && !beatSet.has(p));

    for (const pulse of gridPoints) {
      specs.push({
        key: `grid-${pulse}`,
        type: "grid-line",
        x: 0,
        y: trackHeight - pulse * scaleY - 1,
        width: timelineWidth,
        height: 1,
        data: { color: "var(--gray-6)" },
        testId: "snap-line",
      });
    }

    // --- Selection box (during drag) ---
    const boxRect = boxSelection.getBoxRect();
    if (boxRect) {
      if (
        boxRect.minCol >= 0 &&
        boxRect.maxCol >= 0 &&
        boxRect.minCol < columns.length &&
        boxRect.maxCol < columns.length
      ) {
        const startCol = columns[boxRect.minCol]!;
        const endCol = columns[boxRect.maxCol]!;
        specs.push({
          key: "selection-box",
          type: "selection-box",
          x: startCol.x,
          y: trackHeight - boxRect.maxPulse * scaleY,
          width: endCol.x + endCol.width - startCol.x,
          height: (boxRect.maxPulse - boxRect.minPulse) * scaleY,
          data: {},
          testId: "selection-box",
        });
      }
    }

    return specs;
  }
}
