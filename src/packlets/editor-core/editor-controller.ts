/**
 * @packageDocumentation
 *
 * Central state brain for the beatmap editor. React is a dumb view layer;
 * this packlet owns all editor-relevant state, model data, and interaction logic.
 */

import { createNanoEvents } from "nanoevents";
import type { Emitter } from "nanoevents";
import { EntityManager } from "../entity-manager";
import type { TimingEngine } from "../timing-engine";
import { Point } from "../geometry";
import {
  type EditorControllerOptions,
  type LevelInfo,
  type EditorOutboxEvents,
  type UserAction,
} from "./types";
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
import { SoundColumnsSlice } from "./slices/sound-columns-slice";
import { RenderSlice } from "./slices/render-slice";
import { PointerInteractionSlice } from "./slices/pointer-interaction-slice";
import { DragSlice } from "./slices/drag-slice";
import { ViewCommandSlice } from "./slices/view-command-slice";
import { EditorCommandSlice } from "./slices/editor-command-slice";

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

  get $selectedLevelId() {
    return this.ctx.get(LevelSlice).$selectedLevelId;
  }

  get $cursorPulse() {
    return this.ctx.get(CursorSlice).$cursorPulse;
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
    this.ctx.register(SoundColumnsSlice);
    this.ctx.register(DragSlice);
    this.ctx.register(RenderSlice);
    this.ctx.register(PointerInteractionSlice);
    this.ctx.register(ViewCommandSlice);
    this.ctx.register(EditorCommandSlice);

    this.ctx.get(ViewportSlice).onViewportChanged(() => {
      this.pointer.recomputeCursorPulse();
      this.render.refresh();
    });

    this.ctx.get(ViewportSlice).onScrollRequest((point) => {
      this.outbox.emit("setScroll", point);
    });

    this.ctx.get(ToolSlice).onToolChanged(() => {
      this.render.refresh();
    });

    this.ctx.get(SnapSlice).onSnapChanged(() => {
      const currentPulse = this.cursor.$cursorPulse.get();
      const snapped = this.snapToGrid(currentPulse);
      this.cursor.$cursorPulse.set(snapped);
    });

    this.ctx.get(ColumnsSlice).$columns.subscribe(() => {
      this.render.refresh();
    });

    this.ctx.get(ColumnsSlice).refreshColumns();
  }

  getLevelsForChart(chartId: string): LevelInfo[] {
    return this.ctx.get(LevelSlice).getLevelsForChart(chartId);
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

  setSelectedLevelId(id: string | null): void {
    this.ctx.get(LevelSlice).setSelectedLevelId(id);
  }

  addChart(name?: string, size?: number, soundLanes?: number): string {
    return this.ctx.get(ChartSlice).addChart(name, size, soundLanes);
  }

  removeChart(chartId: string): void {
    this.ctx.get(ChartSlice).removeChart(chartId);
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
    this.ctx.get(ViewCommandSlice).setZoom(zoom);
  }

  zoomIn(): void {
    this.ctx.get(ViewCommandSlice).zoomIn();
  }

  zoomOut(): void {
    this.ctx.get(ViewCommandSlice).zoomOut();
  }

  applyAction(action: UserAction): void {
    this.history.applyAction(action);
  }

  deleteSelection(): void {
    this.ctx.get(EditorCommandSlice).deleteSelection();
  }

  undo(): void {
    this.history.undo();
  }

  redo(): void {
    this.history.redo();
  }

  navigateSnap(direction: "up" | "down"): void {
    this.ctx.get(ViewCommandSlice).navigateSnap(direction);
  }

  onConnected(): void {
    const contentHeight = this.viewport.getContentHeight();
    const viewportHeight = this.viewport.$viewportSize.get().height;
    if (contentHeight > viewportHeight) {
      this.viewport.requestScroll({
        x: this.viewport.$scroll.get().x,
        y: contentHeight - viewportHeight,
      });
    }
  }

  getEntityManager(): EntityManager {
    return this.entityManager;
  }

  snapToGrid(pulse: number): number {
    return this.getTimingEngine().snapPulse(pulse, this.$snap.get());
  }

  getTimingEngine(): TimingEngine {
    return this.timing.getTimingEngine();
  }

  getTimelineWidth(): number {
    return this.columnsSlice.$timelineWidth.get();
  }

  setSelectedChartId(id: string | null): void {
    this.ctx.get(ChartSlice).setSelectedChartId(id);
  }

  getCharts(): import("../entity-manager").Entity[] {
    return this.ctx.get(ChartSlice).getCharts();
  }
}
