import { atom, computed, type ReadableAtom } from "nanostores";
import { Slice } from "../slice.ts";
import type { EditorContext } from "../editor-context.ts";
import { ProjectSlice } from "./project-slice.ts";
import { ChartSlice } from "./chart-slice.ts";
import { ViewportSlice } from "./viewport-slice.ts";
import { ColumnsSlice } from "./columns-slice.ts";
import { SelectionSlice } from "./selection-slice.ts";
import { BoxSelectionSlice } from "./box-selection-slice.ts";
import { CursorSlice } from "./cursor-slice.ts";
import { SnapSlice } from "./snap-slice.ts";
import { TimingSlice } from "./timing-slice.ts";
import {
  EVENT,
  NOTE,
  LEVEL_REF,
  LEVEL,
  BPM_CHANGE,
  TIME_SIGNATURE,
  SOFLAN,
  formatSoflanText,
  CHART_REF,
  SOUND_EVENT,
  SOUND_CHANNEL,
} from "../components.ts";
import type { TimelineRenderSpec } from "../types.ts";
import type { TimelineColumn } from "../types.ts";
import { DragSlice } from "./drag-slice.ts";
import { buildFlatList } from "./column-flat-list.ts";
import { WaveformSlice } from "./waveform-slice.ts";
import { computeWaveformOffsets, type SoundEventInput } from "../waveform-slicer.ts";
import { computeWaveformSegments } from "../waveform-segments.ts";
import { SOUND_GROUP } from "../components.ts";
import { ZoomSlice } from "./zoom-slice.ts";
import { perf } from "../../perf/index.ts";
import { GameModeRegistrySlice } from "./game-mode-registry-slice.ts";
import { findMatchingRule } from "../coloring-rule-system.ts";
import { $extensionDecorations } from "../../extensions/index.ts";

function getGhostTargetColumn(
  entityId: string,
  originalColumn: TimelineColumn,
  originalColumnIndices: Map<string, number>,
  deltaColumnIndex: number,
  flatList: readonly TimelineColumn[],
): TimelineColumn {
  const originalIdx = originalColumnIndices.get(entityId);
  if (originalIdx === undefined || deltaColumnIndex === 0) return originalColumn;
  const newIdx = originalIdx + deltaColumnIndex;
  if (newIdx < 0 || newIdx >= flatList.length) return originalColumn;
  return flatList[newIdx] ?? originalColumn;
}

interface WaveformSegment {
  key: string;
  pulseStart: number;
  pulseEnd: number;
  x: number;
  y: number;
  width: number;
  rpLength: number;
  color: string;
  getWaveformPixels(): { peak: Float32Array; rms: Float32Array };
}

export class RenderSlice extends Slice {
  static readonly sliceKey = "render";

  $rerenderRequestCount = atom(0);

  $visibleRenderObjects: ReadableAtom<TimelineRenderSpec[]>;

  $waveformSlices!: ReadableAtom<WaveformSegment[]>;

  private _lastWaveformFingerprint = "";
  private _cachedWaveformSlices: WaveformSegment[] = [];

  constructor(ctx: EditorContext) {
    super(ctx);
    ctx.get(ProjectSlice).entityManager.$mutationVersion.subscribe(() => {
      this.requestRerender();
    });
    ctx.get(SelectionSlice).$selection.subscribe(() => {
      this.requestRerender();
    });
    ctx.get(CursorSlice).$cursorPulse.subscribe(() => {
      this.requestRerender();
    });
    ctx.get(CursorSlice).$cursorViewportPos.subscribe(() => {
      this.requestRerender();
    });
    ctx.get(CursorSlice).$cursorColumnId.subscribe(() => {
      this.requestRerender();
    });

    this.$waveformSlices = computed(
      [
        ctx.get(ProjectSlice).entityManager.$mutationVersion,
        ctx.get(WaveformSlice).$waveformData,
        ctx.get(ZoomSlice).$zoom,
        ctx.get(ChartSlice).$selectedChartId,
      ],
      () => this.computeWaveformSlices(),
    );

    this.$waveformSlices.subscribe(() => {
      this.requestRerender();
    });

    $extensionDecorations.subscribe(() => {
      this.requestRerender();
    });

    this.$visibleRenderObjects = computed([this.$rerenderRequestCount], () => this.computeSpecs());
  }

  requestRerender(): void {
    this.$rerenderRequestCount.set(this.$rerenderRequestCount.get() + 1);
  }

  private computeSpecs(): TimelineRenderSpec[] {
    perf.incrementCounter("renderNumber");
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
    const dragSlice = this.ctx.get(DragSlice);
    const isDragging = dragSlice.isDragging();
    const deltaPulse = dragSlice.getDeltaPulse();
    const deltaColumnIndex = dragSlice.getDeltaColumnIndex();
    const draggedEntityIds = isDragging
      ? new Set(dragSlice.getOriginalPulses().keys())
      : new Set<string>();
    const originalColumnIndices = dragSlice.getOriginalColumnIndices();

    const gameplayAnchor = columns.find((c) => c.affinity === "gameplay");
    const soundAnchor = columns.find((c) => c.affinity === "sound");
    const gameplayFlatList = gameplayAnchor ? buildFlatList(columns, gameplayAnchor) : [];
    const soundFlatList = soundAnchor ? buildFlatList(columns, soundAnchor) : [];

    // --- Column backgrounds (scroll layer) ---
    perf.measure("computeSpecs:misc", () => {
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
          zIndex: 0,
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
        zIndex: 0,
      });
    }); // end computeSpecs:misc

    // --- Gameplay notes ---
    const gameModeRegistry = this.ctx.get(GameModeRegistrySlice);
    perf.measure("computeSpecs:events", () => {
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
        const isSelected =
          selection.$selection.get().has(entity.id) || boxSelection.isInBox(pulse, colIndex);
        const isDragged = draggedEntityIds.has(entity.id);

        // Resolve coloring rules
        let noteColor = laneCol.noteColor ?? "var(--accent-9)";
        const levelEntity = entityManager.get(levelRef.levelId);
        const levelComponent = levelEntity
          ? entityManager.getComponent(levelEntity, LEVEL)
          : undefined;
        if (levelComponent?.mode) {
          const rules = gameModeRegistry.getColoringRulesForMode(levelComponent.mode);
          if (rules.length > 0) {
            const matched = findMatchingRule(rules, entity.components);
            if (matched) noteColor = matched.noteColor;
          }
        }

        specs.push({
          key: `note-${entity.id}`,
          type: "event-marker",
          x: laneCol.x,
          y: trackHeight - pulse * scaleY - 14,
          width: laneCol.width,
          height: 14,
          data: {
            text: "",
            backgroundColor: noteColor,
            textColor: "#fff",
            selected: isSelected,
          },
          testId: "note",
          entityId: entity.id,
          zIndex: 2,
          opacity: isDragging && isDragged ? 0.3 : undefined,
        });

        if (isDragging && isDragged) {
          const ghostPulse = pulse + deltaPulse;
          if (ghostPulse >= pulseStart && ghostPulse < pulseEnd) {
            const ghostCol = getGhostTargetColumn(
              entity.id,
              laneCol,
              originalColumnIndices,
              deltaColumnIndex,
              gameplayFlatList,
            );
            specs.push({
              key: `note-ghost-${entity.id}`,
              type: "event-marker",
              x: ghostCol.x,
              y: trackHeight - ghostPulse * scaleY - 14,
              width: ghostCol.width,
              height: 14,
              data: {
                text: "",
                backgroundColor: noteColor,
                textColor: "#fff",
                selected: true,
              },
              testId: "note-ghost",
              zIndex: 3,
              opacity: 0.5,
            });
          }
        }
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

          const isSelected =
            selection.$selection.get().has(entity.id) || boxSelection.isInBox(pulse, bpmColIndex);
          const isDragged = draggedEntityIds.has(entity.id);

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
              selected: isSelected,
            },
            testId: "bpm-change-marker",
            entityId: entity.id,
            zIndex: 2,
            opacity: isDragging && isDragged ? 0.3 : undefined,
          });

          if (isDragging && isDragged) {
            const ghostPulse = pulse + deltaPulse;
            if (ghostPulse >= pulseStart && ghostPulse < pulseEnd) {
              const ghostCol = getGhostTargetColumn(
                entity.id,
                bpmColumn,
                originalColumnIndices,
                deltaColumnIndex,
                gameplayFlatList,
              );
              specs.push({
                key: `bpm-ghost-${entity.id}`,
                type: "event-marker",
                x: ghostCol.x,
                y: trackHeight - ghostPulse * scaleY - 14,
                width: ghostCol.width,
                height: 14,
                data: {
                  text: String(bpm.bpm),
                  backgroundColor: "var(--yellow-6)",
                  textColor: "#fff",
                  selected: true,
                },
                testId: "bpm-change-ghost",
                zIndex: 3,
                opacity: 0.5,
              });
            }
          }
        }
      }

      // --- Soflan event markers ---
      const soflanColumns = columns.filter((c) => c.id.startsWith("soflan-"));
      if (soflanColumns.length > 0) {
        for (const entity of entityManager.entitiesWithComponent(SOFLAN)) {
          const event = entityManager.getComponent(entity, EVENT);
          const soflan = entityManager.getComponent(entity, SOFLAN) as
            | {
                scroll: { numerator: number; denominator: number };
                skip: { numerator: number; denominator: number };
              }
            | undefined;
          const levelRef = entityManager.getComponent(entity, LEVEL_REF);
          if (!event || !soflan || !levelRef) continue;
          const pulse = event.y;
          if (pulse < pulseStart || pulse >= pulseEnd) continue;

          const col = soflanColumns.find((c) => c.levelId === levelRef.levelId);
          if (!col) continue;
          const colIndex = columns.indexOf(col);

          const isSelected =
            selection.$selection.get().has(entity.id) || boxSelection.isInBox(pulse, colIndex);
          const isDragged = draggedEntityIds.has(entity.id);

          const text = formatSoflanText(soflan);

          specs.push({
            key: `soflan-${entity.id}`,
            type: "event-marker",
            x: col.x,
            y: trackHeight - pulse * scaleY - 14,
            width: col.width,
            height: 14,
            data: {
              text,
              backgroundColor: "var(--green-6)",
              textColor: "#fff",
              selected: isSelected,
            },
            testId: "soflan-marker",
            entityId: entity.id,
            zIndex: 2,
            opacity: isDragging && isDragged ? 0.3 : undefined,
          });

          if (isDragging && isDragged) {
            const ghostPulse = pulse + deltaPulse;
            if (ghostPulse >= pulseStart && ghostPulse < pulseEnd) {
              const ghostCol = getGhostTargetColumn(
                entity.id,
                col,
                originalColumnIndices,
                deltaColumnIndex,
                gameplayFlatList,
              );
              specs.push({
                key: `soflan-ghost-${entity.id}`,
                type: "event-marker",
                x: ghostCol.x,
                y: trackHeight - ghostPulse * scaleY - 14,
                width: ghostCol.width,
                height: 14,
                data: {
                  text,
                  backgroundColor: "var(--green-6)",
                  textColor: "#fff",
                  selected: true,
                },
                testId: "soflan-ghost",
                zIndex: 3,
                opacity: 0.5,
              });
            }
          }
        }
      }

      if (tsColumn) {
        for (const entity of entityManager.entitiesWithComponent(TIME_SIGNATURE)) {
          const event = entityManager.getComponent(entity, EVENT);
          const ts = entityManager.getComponent(entity, TIME_SIGNATURE);
          if (!event || !ts) continue;
          const pulse = event.y;
          if (pulse < pulseStart || pulse >= pulseEnd) continue;

          const isSelected =
            selection.$selection.get().has(entity.id) || boxSelection.isInBox(pulse, tsColIndex);
          const isDragged = draggedEntityIds.has(entity.id);

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
              selected: isSelected,
            },
            testId: "time-sig-marker",
            entityId: entity.id,
            zIndex: 2,
            opacity: isDragging && isDragged ? 0.3 : undefined,
          });

          if (isDragging && isDragged) {
            const ghostPulse = pulse + deltaPulse;
            if (ghostPulse >= pulseStart && ghostPulse < pulseEnd) {
              const ghostCol = getGhostTargetColumn(
                entity.id,
                tsColumn,
                originalColumnIndices,
                deltaColumnIndex,
                gameplayFlatList,
              );
              specs.push({
                key: `ts-ghost-${entity.id}`,
                type: "event-marker",
                x: ghostCol.x,
                y: trackHeight - ghostPulse * scaleY - 14,
                width: ghostCol.width,
                height: 14,
                data: {
                  text: `${ts.numerator}/${ts.denominator}`,
                  backgroundColor: "var(--tomato-6)",
                  textColor: "#fff",
                  selected: true,
                },
                testId: "time-sig-ghost",
                zIndex: 3,
                opacity: 0.5,
              });
            }
          }
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
        const soundChannelPath = soundChannel
          ? entityManager.getComponent(soundChannel, SOUND_CHANNEL)?.path
          : undefined;
        const soundChannelName = soundChannelPath
          ? (soundChannelPath.split("/").pop() ?? "?")
          : "?";

        const isSelected =
          selection.$selection.get().has(entity.id) || boxSelection.isInBox(pulse, colIndex);
        const isDragged = draggedEntityIds.has(entity.id);

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
            selected: isSelected,
          },
          testId: "sound-event-marker",
          entityId: entity.id,
          zIndex: 2,
          opacity: isDragging && isDragged ? 0.3 : undefined,
        });

        if (isDragging && isDragged) {
          const ghostPulse = pulse + deltaPulse;
          if (ghostPulse >= pulseStart && ghostPulse < pulseEnd) {
            const ghostCol = getGhostTargetColumn(
              entity.id,
              soundLaneCol,
              originalColumnIndices,
              deltaColumnIndex,
              soundFlatList,
            );
            specs.push({
              key: `sound-ghost-${entity.id}`,
              type: "event-marker",
              x: ghostCol.x,
              y: trackHeight - ghostPulse * scaleY - 14,
              width: ghostCol.width,
              height: 14,
              data: {
                text: `${soundChannelName} [${soundEvent.command}]`,
                backgroundColor: "var(--blue-6)",
                textColor: "#fff",
                selected: true,
              },
              testId: "sound-event-ghost",
              zIndex: 3,
              opacity: 0.5,
            });
          }
        }
      }
    }); // end computeSpecs:events

    // --- Extension decorations (lines, arrows) from workers ---
    perf.measure("computeSpecs:decorations", () => {
      for (const dec of $extensionDecorations.get()) {
        if (dec.type === "arrow") {
          const col = dec.levelId
            ? columns.find((c) => c.laneIndex === dec.lane && c.levelId === dec.levelId)
            : columns.find((c) => c.laneIndex === dec.lane);
          if (!col) continue;
          const y = trackHeight - dec.pulse * scaleY;
          if (dec.pulse < pulseStart || dec.pulse >= pulseEnd) continue;
          specs.push({
            key: `flick-arrow-${dec.pulse}-${dec.lane}-${dec.levelId ?? ""}`,
            type: "decoration-arrow",
            x: col.x,
            y: y - 36,
            width: col.width,
            height: 24,
            data: { angle: dec.angle, color: dec.color } as Record<string, unknown>,
            zIndex: 2,
          });
        } else if (dec.type === "line") {
          const fromCol = dec.levelId
            ? columns.find((c) => c.laneIndex === dec.from.lane && c.levelId === dec.levelId)
            : columns.find((c) => c.laneIndex === dec.from.lane);
          const toCol = dec.levelId
            ? columns.find((c) => c.laneIndex === dec.to.lane && c.levelId === dec.levelId)
            : columns.find((c) => c.laneIndex === dec.to.lane);
          if (!fromCol || !toCol) continue;

          // Anchor to center of event marker (14px tall rectangles)
          const EVENT_HEIGHT = 14;
          const fromCenterY = trackHeight - dec.from.pulse * scaleY - EVENT_HEIGHT / 2;
          const toCenterY = trackHeight - dec.to.pulse * scaleY - EVENT_HEIGHT / 2;
          const fromColCenter = fromCol.x + fromCol.width / 2;
          const toColCenter = toCol.x + toCol.width / 2;

          // Skip if both endpoints are outside the visible range
          if (dec.from.pulse < pulseStart && dec.to.pulse < pulseStart) continue;
          if (dec.from.pulse >= pulseEnd && dec.to.pulse >= pulseEnd) continue;

          // Convert optional cubic bezier CPs from normalized space (0=source/dec.to, 1=dest/dec.from) to pixel space
          const cp1 = dec.cp1;
          const cp2 = dec.cp2;
          const cp1Pixel = cp1
            ? {
                x: toColCenter + cp1.x * (fromColCenter - toColCenter),
                y: toCenterY + cp1.y * (fromCenterY - toCenterY),
              }
            : undefined;
          const cp2Pixel = cp2
            ? {
                x: toColCenter + cp2.x * (fromColCenter - toColCenter),
                y: toCenterY + cp2.y * (fromCenterY - toCenterY),
              }
            : undefined;

          const allX = [fromColCenter, toColCenter];
          const allY = [fromCenterY, toCenterY];
          if (cp1Pixel) {
            allX.push(cp1Pixel.x);
            allY.push(cp1Pixel.y);
          }
          if (cp2Pixel) {
            allX.push(cp2Pixel.x);
            allY.push(cp2Pixel.y);
          }
          const containerX = Math.min(...allX);
          const containerY = Math.min(...allY);
          const containerW = Math.max(...allX) - containerX || 1;
          const containerH = Math.max(...allY) - containerY || 1;

          specs.push({
            key: `decoration-${dec.from.pulse}-${dec.from.lane}-${dec.to.pulse}-${dec.to.lane}-${dec.levelId ?? ""}`,
            type: "decoration-line",
            x: containerX,
            y: containerY,
            width: containerW,
            height: containerH,
            data: {
              fromX: fromColCenter - containerX,
              fromY: fromCenterY - containerY,
              toX: toColCenter - containerX,
              toY: toCenterY - containerY,
              cp1x: cp1Pixel ? cp1Pixel.x - containerX : undefined,
              cp1y: cp1Pixel ? cp1Pixel.y - containerY : undefined,
              cp2x: cp2Pixel ? cp2Pixel.x - containerX : undefined,
              cp2y: cp2Pixel ? cp2Pixel.y - containerY : undefined,
              color: dec.color,
              width: 8,
            } as Record<string, unknown>,
            zIndex: 2,
          });
        }
      }
    }); // end computeSpecs:decorations

    // --- Waveform segments (pre-computed, filtered by visibility) ---
    const scrollY = viewport.$scroll.get().y;
    const viewH = viewport.$viewportSize.get().height;
    perf.measure("computeSpecs:waveforms", () => {
      for (const segment of this.$waveformSlices?.get() ?? []) {
        if (segment.pulseEnd <= pulseStart || segment.pulseStart >= pulseEnd) continue;
        // Pixel-level visibility: segments from the same event share pulseStart/End
        // but differ in Y position. Skip those outside the viewport's Y range.
        if (segment.y + segment.rpLength <= scrollY || segment.y >= scrollY + viewH) continue;
        const { peak, rms } = segment.getWaveformPixels();
        specs.push({
          key: segment.key,
          type: "waveform",
          x: segment.x,
          y: segment.y,
          width: segment.width,
          height: segment.rpLength,
          data: {
            peak,
            rms,
            color: segment.color,
            width: segment.width,
          },
          zIndex: 1,
        });
      }
    }); // end computeSpecs:waveforms

    // --- Playhead ---
    perf.measure("computeSpecs:grid", () => {
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
          zIndex: 3,
        });
      }

      // --- Column cursor indicator ---
      const cursorColumnId = cursor.$cursorColumnId.get();
      if (cursorColumnId) {
        const col = columns.find((c) => c.id === cursorColumnId);
        if (col) {
          const indicatorHeight = 8;
          const indicatorWidth = indicatorHeight * 2;
          specs.push({
            key: "column-cursor",
            type: "column-cursor",
            x: col.x + (col.width - indicatorWidth) / 2,
            y: trackHeight - cursorPulse * scaleY + 1,
            width: indicatorWidth,
            height: indicatorHeight,
            data: {},
            zIndex: 4,
          });
        }
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
          zIndex: 1,
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
          zIndex: 1,
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
          zIndex: 1,
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
            zIndex: 4,
          });
        }
      }
    }); // end computeSpecs:grid

    return specs;
  }

  private computeWaveformSlices(): WaveformSegment[] {
    const chartSlice = this.ctx.get(ChartSlice);
    const viewport = this.ctx.get(ViewportSlice);
    const waveformSlice = this.ctx.get(WaveformSlice);
    const columnsSlice = this.ctx.get(ColumnsSlice);
    const entityManager = this.ctx.get(ProjectSlice).entityManager;

    const selectedChartId = chartSlice.$selectedChartId.get();
    if (!selectedChartId) return [];

    const scaleY = viewport.getScaleY();
    const size = chartSlice.getChartSize();
    const waveformMap = waveformSlice.$waveformData.get();
    const timing = this.ctx.get(TimingSlice);
    const timingEngine = timing.getTimingEngine();
    const trackHeight = viewport.getTrackHeight();
    const columns = columnsSlice.$columns.get();

    const soundEventInputs: SoundEventInput[] = [];
    for (const entity of entityManager.entitiesWithComponent(SOUND_EVENT)) {
      const e = entityManager.getComponent(entity, EVENT);
      const se = entityManager.getComponent(entity, SOUND_EVENT);
      const cr = entityManager.getComponent(entity, CHART_REF);
      if (!e || !se || !cr || cr.chartId !== selectedChartId) continue;
      soundEventInputs.push({
        entityId: entity.id,
        pulse: e.y,
        soundLane: se.soundLane,
        soundChannelId: se.soundChannelId,
        command: se.command,
      });
    }

    const trimPulseByEntityId = new Map<string, number>();
    {
      const sortedPulsesByLane = new Map<number, number[]>();
      for (const sei of soundEventInputs) {
        let pulses = sortedPulsesByLane.get(sei.soundLane);
        if (!pulses) sortedPulsesByLane.set(sei.soundLane, (pulses = []));
        pulses.push(sei.pulse);
      }
      for (const pulses of sortedPulsesByLane.values()) pulses.sort((a, b) => a - b);
      for (const sei of soundEventInputs) {
        const pulses = sortedPulsesByLane.get(sei.soundLane)!;
        const idx = pulses.indexOf(sei.pulse);
        const nextPulse = idx + 1 < pulses.length ? pulses[idx + 1] : null;
        trimPulseByEntityId.set(sei.entityId, nextPulse ?? size);
      }
    }

    let fp = `${selectedChartId}|${scaleY}|${size}|${waveformMap.size}`;
    for (const sei of soundEventInputs) {
      const eventChartSec = timingEngine.pulseToSeconds(sei.pulse);
      const trimPulse = trimPulseByEntityId.get(sei.entityId)!;
      const endChartSec = timingEngine.pulseToSeconds(trimPulse);
      fp += `|${sei.entityId}:${sei.pulse}:${sei.soundLane}:${sei.soundChannelId}:${eventChartSec}:${endChartSec}`;
    }

    if (fp === this._lastWaveformFingerprint) return this._cachedWaveformSlices;
    this._lastWaveformFingerprint = fp;

    const channelDurations = new Map<string, { durationSec: number }>();
    for (const sei of soundEventInputs) {
      const soundChannel = entityManager.get(sei.soundChannelId);
      const channelPath = soundChannel
        ? entityManager.getComponent(soundChannel, SOUND_CHANNEL)?.path
        : undefined;
      if (channelPath && waveformMap.has(channelPath)) {
        const wd = waveformMap.get(channelPath)!;
        channelDurations.set(sei.soundChannelId, { durationSec: wd.durationSec });
      }
    }

    const offsets = computeWaveformOffsets(soundEventInputs, channelDurations, (pulse: number) =>
      timingEngine.pulseToSeconds(pulse),
    );

    const slices: WaveformSegment[] = [];

    for (const sei of soundEventInputs) {
      const entity = entityManager.get(sei.entityId);
      if (!entity) continue;

      const soundChannel = entityManager.get(sei.soundChannelId);
      const soundChannelPath = soundChannel
        ? entityManager.getComponent(soundChannel, SOUND_CHANNEL)?.path
        : undefined;
      if (!soundChannelPath || !waveformMap.has(soundChannelPath)) continue;

      const wd = waveformMap.get(soundChannelPath)!;
      const offsetInfo = offsets.get(sei.entityId);

      const soundLaneCol = columns.find((c) => c.soundLane === sei.soundLane);
      if (!soundLaneCol) continue;

      const pulse = sei.pulse;
      const trimPulse = trimPulseByEntityId.get(sei.entityId)!;

      const sampleOffsetAudioSec = offsetInfo?.sampleOffsetAudioSec ?? 0;
      const eventChartSec = timingEngine.pulseToSeconds(pulse);

      const waveformTopY = trackHeight - trimPulse * scaleY;
      const waveformBottomY = trackHeight - pulse * scaleY;
      const rpLength = Math.max(1, Math.round(waveformBottomY - waveformTopY));
      const framesPerSec = 120;

      const getFrameRange = (
        renderingPos: number,
        _rpLength: number,
      ): { startFrame: number; endFrame: number } | null => {
        const pulseA = pulse + renderingPos / scaleY;
        const pulseB = pulse + (renderingPos + 1) / scaleY;

        const chartSecA = timingEngine.pulseToSeconds(pulseA);
        const chartSecB = timingEngine.pulseToSeconds(pulseB);

        const audioSecA = chartSecA - eventChartSec + sampleOffsetAudioSec;
        const audioSecB = chartSecB - eventChartSec + sampleOffsetAudioSec;

        const audioSecTop = Math.max(audioSecA, audioSecB);
        const audioSecBottom = Math.min(audioSecA, audioSecB);

        let frameStart = Math.floor(audioSecBottom * framesPerSec);
        let frameEnd = Math.ceil(audioSecTop * framesPerSec);
        if (frameEnd <= frameStart) frameEnd = frameStart + 1;
        if (frameEnd <= 0) return null;

        return { startFrame: frameStart, endFrame: frameEnd };
      };

      const segments = computeWaveformSegments(wd.peak, wd.rms, {
        rpLength,
        maxSegmentPixels: 512,
        getFrameRange,
      });

      let groupColor: string | undefined;
      if (soundChannel) {
        const groupId = entityManager.getComponent(soundChannel, SOUND_CHANNEL)?.soundGroupId;
        if (groupId) {
          const group = entityManager.get(groupId);
          if (group) {
            groupColor = entityManager.getComponent(group, SOUND_GROUP)?.color;
          }
        }
      }

      for (const segment of segments) {
        slices.push({
          key: `waveform-${entity.id}-${segment.rpStart}`,
          pulseStart: pulse,
          pulseEnd: trimPulse,
          x: soundLaneCol.x + 4,
          y: waveformBottomY - segment.rpStart - segment.rpLength,
          width: soundLaneCol.width - 8,
          rpLength: segment.rpLength,
          color: groupColor || "#fff",
          getWaveformPixels: () => segment.getWaveformPixels(),
        });
      }
    }

    this._lastWaveformFingerprint = fp;
    this._cachedWaveformSlices = slices;
    return slices;
  }
}
