/**
 * @packageDocumentation
 *
 * Central state brain for the beatmap editor. React is a dumb view layer;
 * this packlet owns all editor-relevant state, model data, and interaction logic.
 */

import { createNanoEvents } from "nanoevents";
import type { Emitter } from "nanoevents";
import { EntityManager, type Entity } from "../entity-manager";
import type { TimingEngine } from "../timing-engine";
import { Point } from "../geometry";
import {
  type EditorControllerOptions,
  type TimelineColumn,
  type LevelInfo,
  type EditorOutboxEvents,
  type UserAction,
  BASE_SCALE_Y,
} from "./types";
import { DeleteUserAction } from "./user-actions";
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
import { PointerInteractionSlice } from "./slices/pointer-interaction-slice";

export class EditorController {
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

  private get timing(): TimingSlice {
    return this.ctx.get(TimingSlice);
  }

  private get columnsSlice(): ColumnsSlice {
    return this.ctx.get(ColumnsSlice);
  }

  get $lastPlacedEntityInfo() {
    return this.ctx.get(PointerInteractionSlice).$lastPlacedEntityInfo;
  }

  private get render(): RenderSlice {
    return this.ctx.get(RenderSlice);
  }

  private get pointer(): PointerInteractionSlice {
    return this.ctx.get(PointerInteractionSlice);
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
    this.ctx.register(PointerInteractionSlice);

    this.ctx.get(ViewportSlice).onViewportChanged(() => {
      this.pointer.recomputeCursorPulse();
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

  hitTest(point: Point): string | null {
    return this.pointer.hitTest(point);
  }

  handlePointerDown(point: Point, shiftKey: boolean = false): void {
    this.pointer.handlePointerDown(point, shiftKey);
  }

  handlePointerMove(viewportX: number, viewportY: number): void {
    this.pointer.handlePointerMove(viewportX, viewportY);
  }

  handlePointerUp(): void {
    this.pointer.handlePointerUp();
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

    this.applyAction(new DeleteUserAction(this.ctx, entityIds, entities));
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
