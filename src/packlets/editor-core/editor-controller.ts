/**
 * @packageDocumentation
 *
 * Central state brain for the beatmap editor. React is a dumb view layer;
 * this packlet owns all editor-relevant state, model data, and interaction logic.
 */

import { atom } from "nanostores";
import { createNanoEvents } from "nanoevents";
import type { Emitter } from "nanoevents";
import { uuidv7 } from "uuidv7";
import { EntityManager, type Entity } from "../entity-manager";
import { createTimingEngine } from "../timing-engine";
import type { TimingEngine } from "../timing-engine";
import { EVENT, BPM_CHANGE, TIME_SIGNATURE, CHART_REF, LEVEL_REF, LEVEL, NOTE } from "./components";
import { getGameModeLayout } from "./lane-layouts";
import { Point, Rect } from "../geometry";
import {
  type EditorControllerOptions,
  type TimelineColumn,
  type LevelInfo,
  type TimelineRenderSpec,
  type EditorOutboxEvents,
  type UserAction,
  BASE_SCALE_Y,
} from "./types";
import { DeleteUserAction, EraseUserAction, PlaceEntityUserAction } from "./user-actions";
import { EditorContext } from "./editor-context";
import { SnapSlice } from "./slices/snap-slice";
import { ZoomSlice } from "./slices/zoom-slice";
import { ProjectSlice } from "./slices/project-slice";
import { ChartSlice } from "./slices/chart-slice";
import { LevelSlice } from "./slices/level-slice";
import { ViewportSlice } from "./slices/viewport-slice";
import { CursorSlice } from "./slices/cursor-slice";
import { SelectionSlice } from "./slices/selection-slice";
import { HistorySlice } from "./slices/history-slice";
import { BoxSelectionSlice } from "./slices/box-selection-slice";

export class EditorController {
  $visibleRenderObjects = atom<TimelineRenderSpec[]>([]);
  $activeTool = atom<"select" | "pencil" | "erase" | "pan">("select");
  $lastPlacedEntityInfo = atom<{ entityId: string; columnId: string } | null>(null);
  outbox: Emitter<EditorOutboxEvents> = createNanoEvents<EditorOutboxEvents>();

  ctx = new EditorContext();

  get $snap() {
    return this.ctx.get(SnapSlice).$snap;
  }

  get $zoom() {
    return this.ctx.get(ZoomSlice).$zoom;
  }

  get $selectedChartId() {
    return this.ctx.get(ChartSlice).$selectedChartId;
  }

  get $hiddenLevelIds() {
    return this.ctx.get(LevelSlice).$hiddenLevelIds;
  }

  get $scroll() {
    return this.ctx.get(ViewportSlice).$scroll;
  }

  get $viewportSize() {
    return this.ctx.get(ViewportSlice).$viewportSize;
  }

  get $cursorPulse() {
    return this.ctx.get(CursorSlice).$cursorPulse;
  }

  get $cursorViewportPos() {
    return this.ctx.get(CursorSlice).$cursorViewportPos;
  }

  get $selection() {
    return this.ctx.get(SelectionSlice).$selection;
  }

  get $history() {
    return this.ctx.get(HistorySlice).$history;
  }

  private get viewport(): ViewportSlice {
    return this.ctx.get(ViewportSlice);
  }

  private get cursor(): CursorSlice {
    return this.ctx.get(CursorSlice);
  }

  private get history(): HistorySlice {
    return this.ctx.get(HistorySlice);
  }

  private get boxSelection(): BoxSelectionSlice {
    return this.ctx.get(BoxSelectionSlice);
  }

  private columns: TimelineColumn[];
  private timelineWidth: number;
  private timingEngineCache: TimingEngine | null = null;
  private timingEngineVersion = 0;

  private get entityManager(): EntityManager {
    return this.ctx.get(ProjectSlice).entityManager;
  }

  constructor(options: EditorControllerOptions) {
    this.ctx.register(ProjectSlice, (ctx) => new ProjectSlice(ctx, options.project));
    this.ctx.register(ChartSlice);
    this.ctx.register(LevelSlice);
    this.ctx.register(ViewportSlice);
    this.ctx.register(CursorSlice);
    this.ctx.register(SelectionSlice);
    this.ctx.register(BoxSelectionSlice);
    this.ctx.register(SnapSlice);
    this.ctx.register(ZoomSlice);
    this.ctx.register(HistorySlice);

    const { columns, width } = this.computeColumns();
    this.columns = columns;
    this.timelineWidth = width;

    this.ctx.get(ChartSlice).$selectedChartId.subscribe(() => {
      this.refreshColumns();
      this.updateVisibleRenderObjects();
    });
    this.ctx.get(LevelSlice).$hiddenLevelIds.subscribe(() => {
      this.refreshColumns();
      this.updateVisibleRenderObjects();
    });

    this.ctx.get(SnapSlice).onSnapChanged(() => {
      const currentPulse = this.cursor.$cursorPulse.get();
      const snapped = this.snapToGrid(currentPulse);
      this.cursor.$cursorPulse.set(snapped);
      this.updateVisibleRenderObjects();
    });

    this.ctx.get(ZoomSlice).onZoomChanged(({ oldZoom, newZoom }) => {
      const newScrollTop = this.computeZoomScrollOffset(oldZoom, newZoom);
      this.viewport.setScroll({ x: this.$scroll.get().x, y: newScrollTop });
      this.recomputeCursorPulse();
      this.updateVisibleRenderObjects();
      this.outbox.emit("setScroll", { x: this.$scroll.get().x, y: newScrollTop });
    });
  }

  private computeColumns(): { columns: TimelineColumn[]; width: number } {
    const chartId = this.$selectedChartId.get();

    const defs: TimelineColumn[] = [
      { id: "measure", title: "", width: 40, x: 0 },
      {
        id: "time-sig",
        title: "Time",
        width: 48,
        x: 40,
        placementHandler: (pulse) => {
          if (!chartId) return null;
          const ts = this.getTimingEngine().getTimeSignatureAtPulse(pulse);
          return {
            id: uuidv7(),
            version: uuidv7(),
            components: {
              [EVENT.key]: { y: pulse },
              [TIME_SIGNATURE.key]: { numerator: ts.numerator, denominator: ts.denominator },
              [CHART_REF.key]: { chartId },
            },
          };
        },
      },
      {
        id: "bpm",
        title: "BPM",
        width: 56,
        x: 88,
        placementHandler: (pulse) => {
          if (!chartId) return null;
          const bpm = this.getTimingEngine().getBpmAtPulse(pulse);
          return {
            id: uuidv7(),
            version: uuidv7(),
            components: {
              [EVENT.key]: { y: pulse },
              [BPM_CHANGE.key]: { bpm },
              [CHART_REF.key]: { chartId },
            },
          };
        },
      },
      { id: "spacer", title: "", width: 8, x: 144 },
    ];

    let x = 0;
    const columns: TimelineColumn[] = [];
    for (const def of defs) {
      columns.push({ ...def, x });
      x += def.width;
    }

    // Add gameplay lanes for visible levels.
    if (chartId) {
      const visibleLevels = this.getVisibleLevels();
      for (const level of visibleLevels) {
        const layout = getGameModeLayout(level.mode);
        if (!layout) continue;
        for (const lane of layout.lanes) {
          columns.push({
            id: `level-${level.id}-lane-${lane.laneIndex}`,
            title: lane.name,
            width: lane.width,
            x,
            backgroundColor: lane.backgroundColor,
            noteColor: lane.noteColor,
            levelId: level.id,
            laneIndex: lane.laneIndex,
            placementHandler: (pulse) => {
              return {
                id: uuidv7(),
                version: uuidv7(),
                components: {
                  [EVENT.key]: { y: pulse },
                  [NOTE.key]: { lane: lane.laneIndex },
                  [LEVEL_REF.key]: { levelId: level.id },
                  [CHART_REF.key]: { chartId },
                },
              };
            },
          });
          x += lane.width;
        }
      }
    }

    // Trailing line after last column.
    const width = x + 1;
    return { columns, width };
  }

  refreshColumns(): void {
    const { columns, width } = this.computeColumns();
    this.columns = columns;
    this.timelineWidth = width;
  }

  getLevelsForChart(chartId: string): LevelInfo[] {
    const levelSlice = this.ctx.get(LevelSlice);
    return levelSlice.getLevelEntitiesForChart(chartId).map((entity) => {
      const level = this.entityManager.getComponent(entity, LEVEL);
      return {
        id: entity.id,
        name: level?.name ?? "Untitled",
        mode: level?.mode ?? "beat-7k",
        sortOrder: level?.sortOrder ?? 0,
        visible: !levelSlice.isLevelHidden(entity.id),
      };
    });
  }

  getVisibleLevels(): LevelInfo[] {
    const chartId = this.$selectedChartId.get();
    if (!chartId) return [];
    return this.getLevelsForChart(chartId).filter((l) => l.visible);
  }

  addLevel(chartId: string, name: string, mode: string): string {
    const id = this.ctx.get(LevelSlice).addLevel(chartId, name, mode);
    this.refreshColumns();
    return id;
  }

  removeLevel(levelId: string): void {
    this.ctx.get(LevelSlice).removeLevel(levelId);
    this.refreshColumns();
  }

  toggleLevelVisibility(levelId: string): void {
    this.ctx.get(LevelSlice).toggleLevelVisibility(levelId);
    this.refreshColumns();
  }

  getScaleY(): number {
    return this.viewport.getScaleY();
  }

  getTrackHeight(): number {
    return this.viewport.getTrackHeight();
  }

  getContentHeight(): number {
    return this.viewport.getContentHeight();
  }

  setScroll(point: Point): void {
    this.viewport.setScroll(point);
    this.recomputeCursorPulse();
    this.updateVisibleRenderObjects();
  }

  setViewportSize(width: number, height: number): void {
    this.viewport.setViewportSize(width, height);
    this.updateVisibleRenderObjects();
  }

  setSnap(snap: string): void {
    this.ctx.get(SnapSlice).setSnap(snap);
  }

  recomputeCursorPulse(): void {
    const viewportY = this.$cursorViewportPos.get().y;
    if (viewportY < 0) return;
    const scrollTop = this.$scroll.get().y;
    const contentY = viewportY + scrollTop;
    const trackHeight = this.viewport.getTrackHeight();
    const scaleY = this.viewport.getScaleY();
    const rawPulse = (trackHeight - contentY) / scaleY;
    const snappedPulse = this.snapToGrid(rawPulse);
    this.$cursorPulse.set(snappedPulse);
  }

  updateVisibleRenderObjects(): void {
    this.$visibleRenderObjects.set(this.getVisibleRenderSpecs());
  }

  hitTest(point: Point): string | null {
    const scroll = this.$scroll.get();
    const contentX = point.x + scroll.x;
    const contentY = point.y + scroll.y;

    const specs = this.getVisibleRenderSpecs();
    const HIT_TOLERANCE = 4;

    let bestId: string | null = null;
    let bestDistance = Infinity;

    for (const spec of specs) {
      if (!spec.entityId) continue;

      const hitRect = Rect.expand(
        { x: spec.x, y: spec.y, width: spec.width, height: spec.height },
        HIT_TOLERANCE,
      );
      if (!Rect.contains(hitRect, { x: contentX, y: contentY })) continue;

      const center = Rect.center({ x: spec.x, y: spec.y, width: spec.width, height: spec.height });
      const distance = Point.distance({ x: contentX, y: contentY }, center);

      if (distance < bestDistance) {
        bestDistance = distance;
        bestId = spec.entityId;
      }
    }

    return bestId;
  }

  private getColumnIndexFromViewportX(viewportX: number): number {
    const contentX = viewportX + this.$scroll.get().x;
    const columns = this.getColumns();
    if (columns.length === 0) return 0;
    if (contentX < columns[0]!.x) return 0;
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i]!;
      if (contentX >= col.x && contentX < col.x + col.width) {
        return i;
      }
    }
    return columns.length - 1;
  }

  private computePulseFromViewportY(viewportY: number): number {
    const scrollTop = this.$scroll.get().y;
    const contentY = viewportY + scrollTop;
    const trackHeight = this.viewport.getTrackHeight();
    const scaleY = this.viewport.getScaleY();
    return (trackHeight - contentY) / scaleY;
  }

  handlePointerDown(point: Point, shiftKey: boolean = false): void {
    if (this.$activeTool.get() === "pencil") {
      const contentX = point.x + this.$scroll.get().x;
      const columns = this.getColumns();
      const column = columns.find((c) => contentX >= c.x && contentX < c.x + c.width);
      if (!column?.placementHandler) return;

      const pulse = this.snapToGrid(this.computePulseFromViewportY(point.y));
      const entity = column.placementHandler(pulse);
      if (!entity) return;

      const previousSelection = new Set(this.$selection.get());
      this.applyAction(new PlaceEntityUserAction(this, entity, column.id, previousSelection));
      return;
    }

    if (this.$activeTool.get() === "erase") {
      const hit = this.hitTest(point);
      if (hit) {
        const entity = this.entityManager.get(hit);
        if (entity) {
          this.applyAction(new EraseUserAction(this, hit, structuredClone(entity)));
        }
      }
      return;
    }

    const hit = this.hitTest(point);
    if (hit) {
      if (shiftKey) {
        const next = new Set(this.$selection.get());
        if (next.has(hit)) {
          next.delete(hit);
        } else {
          next.add(hit);
        }
        this.$selection.set(next);
      } else {
        this.$selection.set(new Set([hit]));
      }
    } else {
      const colIndex = this.getColumnIndexFromViewportX(point.x);
      const pulse = this.computePulseFromViewportY(point.y);
      this.boxSelection.start(colIndex, pulse);
      if (!shiftKey) {
        this.$selection.set(new Set());
      }
    }
    this.updateVisibleRenderObjects();
  }

  private isInBox(pulse: number, colIndex: number): boolean {
    return this.boxSelection.isInBox(pulse, colIndex);
  }

  handlePointerMove(viewportX: number, viewportY: number): void {
    if (this.boxSelection.isActive()) {
      this.boxSelection.update(
        this.getColumnIndexFromViewportX(viewportX),
        this.computePulseFromViewportY(viewportY),
      );
    }
    this.$cursorViewportPos.set({ x: viewportX, y: viewportY });
    this.recomputeCursorPulse();
    this.updateVisibleRenderObjects();
  }

  handlePointerUp(): void {
    if (!this.boxSelection.isActive()) return;
    this.boxSelection.finalize(this.getColumns(), this.entityManager.entitiesWithComponent(EVENT));
    this.updateVisibleRenderObjects();
  }

  setTool(tool: "select" | "pencil" | "erase" | "pan"): void {
    this.$activeTool.set(tool);
    this.updateVisibleRenderObjects();
  }

  setZoom(zoom: number): void {
    this.ctx.get(ZoomSlice).setZoom(zoom);
  }

  zoomIn(): void {
    this.ctx.get(ZoomSlice).zoomIn();
  }

  zoomOut(): void {
    this.ctx.get(ZoomSlice).zoomOut();
  }

  applyAction(action: UserAction): void {
    this.history.applyAction(action);
    this.updateVisibleRenderObjects();
  }

  deleteSelection(): void {
    const selection = this.$selection.get();
    if (selection.size === 0) return;

    const entityIds = Array.from(selection);
    const entities = entityIds
      .map((id) => this.entityManager.get(id))
      .filter((e): e is Entity => e !== undefined)
      .map((e) => structuredClone(e));

    this.applyAction(new DeleteUserAction(this, entityIds, entities));
  }

  undo(): void {
    this.history.undo();
    this.updateVisibleRenderObjects();
  }

  redo(): void {
    this.history.redo();
    this.updateVisibleRenderObjects();
  }

  navigateSnap(direction: "up" | "down"): void {
    const currentPulse = this.$cursorPulse.get();
    const engine = this.getTimingEngine();
    const snap = this.$snap.get();
    const size = this.getChartSize();

    let targetPulse: number;
    if (direction === "up") {
      const points = engine.getSnapPoints(snap, { start: currentPulse, end: size });
      const next = points.find((p) => p > currentPulse);
      targetPulse = next !== undefined ? next : currentPulse;
    } else {
      const points = engine.getSnapPoints(snap, { start: 0, end: currentPulse });
      const prev = points.length > 0 ? points[points.length - 1] : undefined;
      targetPulse = prev !== undefined ? prev : currentPulse;
    }

    const scaleY = this.viewport.getScaleY();
    const trackHeight = this.viewport.getTrackHeight();
    const currentY = trackHeight - currentPulse * scaleY;
    const targetY = trackHeight - targetPulse * scaleY;
    const deltaY = targetY - currentY;

    this.$cursorPulse.set(targetPulse);
    const currentScroll = this.$scroll.get();
    this.setScroll({ x: currentScroll.x, y: currentScroll.y + deltaY });
  }

  onConnected(): void {
    const contentHeight = this.viewport.getContentHeight();
    const viewportHeight = this.$viewportSize.get().height;
    if (contentHeight > viewportHeight) {
      this.outbox.emit("setScroll", { x: this.$scroll.get().x, y: contentHeight - viewportHeight });
    }
  }

  /**
   * Computes the new scroll top after a zoom change so that the playhead
   * stays at the same viewport Y position.
   *
   * @param oldZoom The zoom level before the change.
   * @returns The new scroll top to apply.
   */
  computeZoomScrollOffset(oldZoom: number, newZoom: number): number {
    const size = this.getChartSize();
    const oldScaleY = BASE_SCALE_Y * oldZoom;
    const newScaleY = BASE_SCALE_Y * newZoom;
    const cursorPulse = this.$cursorPulse.get();
    const oldScrollTop = this.$scroll.get().y;
    const oldTrackHeight = size * oldScaleY;
    const newTrackHeight = size * newScaleY;
    const oldPlayheadY = oldTrackHeight - cursorPulse * oldScaleY - 1;
    const newPlayheadY = newTrackHeight - cursorPulse * newScaleY - 1;
    return oldScrollTop + newPlayheadY - oldPlayheadY;
  }

  getEntityManager(): EntityManager {
    return this.entityManager;
  }

  getSelectedChart(): Entity | undefined {
    return this.ctx.get(ChartSlice).getSelectedChart();
  }

  getChartSize(): number {
    return this.ctx.get(ChartSlice).getChartSize();
  }

  snapToGrid(pulse: number): number {
    return this.getTimingEngine().snapPulse(pulse, this.$snap.get());
  }

  getTimingEngine(): TimingEngine {
    const currentVersion = this.entityManager.getMutationVersion();
    if (this.timingEngineCache && this.timingEngineVersion === currentVersion) {
      return this.timingEngineCache;
    }

    const chartId = this.$selectedChartId.get();

    const bpmChanges = this.entityManager
      .entitiesWithComponent(BPM_CHANGE)
      .filter((entity) => {
        if (!chartId) return true;
        const ref = this.entityManager.getComponent(entity, CHART_REF);
        return !ref || ref.chartId === chartId;
      })
      .map((entity) => {
        const event = this.entityManager.getComponent(entity, EVENT);
        const bpm = this.entityManager.getComponent(entity, BPM_CHANGE);
        return {
          pulse: event?.y ?? 0,
          bpm: bpm?.bpm ?? 60,
        };
      })
      .sort((a, b) => a.pulse - b.pulse);

    const timeSignatures = this.entityManager
      .entitiesWithComponent(TIME_SIGNATURE)
      .filter((entity) => {
        if (!chartId) return true;
        const ref = this.entityManager.getComponent(entity, CHART_REF);
        return !ref || ref.chartId === chartId;
      })
      .map((entity) => {
        const event = this.entityManager.getComponent(entity, EVENT);
        const ts = this.entityManager.getComponent(entity, TIME_SIGNATURE);
        return {
          pulse: event?.y ?? 0,
          numerator: ts?.numerator ?? 4,
          denominator: ts?.denominator ?? 4,
        };
      })
      .sort((a, b) => a.pulse - b.pulse);

    const engine = createTimingEngine(bpmChanges, timeSignatures);
    this.timingEngineCache = engine;
    this.timingEngineVersion = currentVersion;
    return engine;
  }

  getColumns(): TimelineColumn[] {
    return this.columns;
  }

  getTimelineWidth(): number {
    return this.timelineWidth;
  }

  getVisibleRenderSpecs(): TimelineRenderSpec[] {
    const size = this.getChartSize();
    const scaleY = this.viewport.getScaleY();
    const trackHeight = this.viewport.getTrackHeight();
    const contentHeight = this.viewport.getContentHeight();
    const pulseRange = this.viewport.getVisiblePulseRange();
    const pulseStart = pulseRange.start;
    const pulseEnd = pulseRange.end;
    const rawPulseStart = pulseRange.rawStart;
    const rawPulseEnd = pulseRange.rawEnd;
    const timelineWidth = this.getTimelineWidth();
    const columns = this.getColumns();

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
    const entityManager = this.getEntityManager();

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
          selected: this.$selection.get().has(entity.id) || this.isInBox(pulse, colIndex),
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
            selected: this.$selection.get().has(entity.id) || this.isInBox(pulse, bpmColIndex),
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
            selected: this.$selection.get().has(entity.id) || this.isInBox(pulse, tsColIndex),
          },
          testId: "time-sig-marker",
          entityId: entity.id,
        });
      }
    }

    // --- Playhead ---
    const cursorPulse = this.$cursorPulse.get();
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
    const engine = this.getTimingEngine();
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
    const snap = this.$snap.get();
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
    const boxRect = this.boxSelection.getBoxRect();
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
