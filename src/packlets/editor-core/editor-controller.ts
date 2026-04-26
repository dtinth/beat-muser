/**
 * @packageDocumentation
 *
 * Central state brain for the beatmap editor. React is a dumb view layer;
 * this packlet owns all editor-relevant state, model data, and interaction logic.
 */

import { atom } from "nanostores";
import { createNanoEvents } from "nanoevents";
import type { Emitter } from "nanoevents";
import { EntityManager, type Entity } from "../entity-manager";
import type { TimingEngine } from "../timing-engine";
import { EVENT } from "./components";
import { Point, Rect } from "../geometry";
import {
  type EditorControllerOptions,
  type TimelineColumn,
  type LevelInfo,
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
import { ToolSlice } from "./slices/tool-slice";
import { TimingSlice } from "./slices/timing-slice";
import { ColumnsSlice } from "./slices/columns-slice";
import { TimingColumnsSlice } from "./slices/timing-columns-slice";
import { LevelColumnsSlice } from "./slices/level-columns-slice";
import { RenderSlice } from "./slices/render-slice";

export class EditorController {
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

  get $activeTool() {
    return this.ctx.get(ToolSlice).$activeTool;
  }

  get $visibleRenderObjects() {
    return this.ctx.get(RenderSlice).$visibleRenderObjects;
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

  private get timing(): TimingSlice {
    return this.ctx.get(TimingSlice);
  }

  private get columnsSlice(): ColumnsSlice {
    return this.ctx.get(ColumnsSlice);
  }

  private get render(): RenderSlice {
    return this.ctx.get(RenderSlice);
  }

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
    this.ctx.register(ToolSlice);
    this.ctx.register(TimingSlice);
    this.ctx.register(ColumnsSlice);
    this.ctx.register(TimingColumnsSlice);
    this.ctx.register(LevelColumnsSlice);
    this.ctx.register(RenderSlice);

    this.ctx.get(ViewportSlice).onViewportChanged(() => {
      this.recomputeCursorPulse();
      this.render.refresh();
    });

    this.ctx.get(ToolSlice).onToolChanged(() => {
      this.render.refresh();
    });

    this.ctx.get(SnapSlice).onSnapChanged(() => {
      const currentPulse = this.cursor.$cursorPulse.get();
      const snapped = this.snapToGrid(currentPulse);
      this.cursor.$cursorPulse.set(snapped);
      this.render.refresh();
    });

    this.ctx.get(ZoomSlice).onZoomChanged(({ oldZoom, newZoom }) => {
      const newScrollTop = this.computeZoomScrollOffset(oldZoom, newZoom);
      this.viewport.setScroll({ x: this.$scroll.get().x, y: newScrollTop });
      this.outbox.emit("setScroll", { x: this.$scroll.get().x, y: newScrollTop });
    });

    this.ctx.get(ColumnsSlice).$columns.subscribe(() => {
      this.render.refresh();
    });

    this.ctx.get(ColumnsSlice).refreshColumns();
  }

  getLevelsForChart(chartId: string): LevelInfo[] {
    return this.ctx.get(LevelSlice).getLevelsForChart(chartId);
  }

  getVisibleLevels(): LevelInfo[] {
    const chartId = this.$selectedChartId.get();
    if (!chartId) return [];
    return this.ctx.get(LevelSlice).getVisibleLevels(chartId);
  }

  addLevel(chartId: string, name: string, mode: string): string {
    return this.ctx.get(LevelSlice).addLevel(chartId, name, mode);
  }

  removeLevel(levelId: string): void {
    this.ctx.get(LevelSlice).removeLevel(levelId);
  }

  toggleLevelVisibility(levelId: string): void {
    this.ctx.get(LevelSlice).toggleLevelVisibility(levelId);
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
  }

  setViewportSize(width: number, height: number): void {
    this.viewport.setViewportSize(width, height);
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
    this.cursor.$cursorPulse.set(snappedPulse);
  }

  hitTest(point: Point): string | null {
    const scroll = this.$scroll.get();
    const contentX = point.x + scroll.x;
    const contentY = point.y + scroll.y;

    const specs = this.render.$visibleRenderObjects.get();
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
    this.render.refresh();
  }

  handlePointerMove(viewportX: number, viewportY: number): void {
    if (this.boxSelection.isActive()) {
      this.boxSelection.update(
        this.getColumnIndexFromViewportX(viewportX),
        this.computePulseFromViewportY(viewportY),
      );
    }
    this.cursor.$cursorViewportPos.set({ x: viewportX, y: viewportY });
    this.recomputeCursorPulse();
    this.render.refresh();
  }

  handlePointerUp(): void {
    if (!this.boxSelection.isActive()) return;
    this.boxSelection.finalize(this.entityManager.entitiesWithComponent(EVENT));
    this.render.refresh();
  }

  setTool(tool: "select" | "pencil" | "erase" | "pan"): void {
    this.ctx.get(ToolSlice).setTool(tool);
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
    this.render.refresh();
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
    this.render.refresh();
  }

  redo(): void {
    this.history.redo();
    this.render.refresh();
  }

  navigateSnap(direction: "up" | "down"): void {
    const currentPulse = this.cursor.$cursorPulse.get();
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

    this.cursor.$cursorPulse.set(targetPulse);
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
    const cursorPulse = this.cursor.$cursorPulse.get();
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
    return this.timing.getTimingEngine();
  }

  getColumns(): TimelineColumn[] {
    return this.columnsSlice.$columns.get();
  }

  getTimelineWidth(): number {
    return this.columnsSlice.$timelineWidth.get();
  }

  refreshRender(): void {
    this.render.refresh();
  }
}
