/**
 * @packageDocumentation
 *
 * Central state brain for the beatmap editor. React is a dumb view layer;
 * this packlet owns all editor-relevant state, model data, and interaction logic.
 */

import { createNanoEvents } from "nanoevents";
import type { Emitter } from "nanoevents";
import { EntityManager } from "../entity-manager/index.ts";
import type { TimingEngine } from "../timing-engine/index.ts";
import { Point } from "../geometry/index.ts";
import { uuidv7 } from "uuidv7";
import {
  type EditorControllerOptions,
  type LevelInfo,
  type EditorOutboxEvents,
  type UserAction,
} from "./types.ts";
import { EditorContext } from "./editor-context.ts";
import { SnapSlice } from "./slices/snap-slice.ts";
import { ZoomSlice } from "./slices/zoom-slice.ts";
import { ProjectSlice } from "./slices/project-slice.ts";
import { ChartSlice } from "./slices/chart-slice.ts";
import { LevelSlice } from "./slices/level-slice.ts";
import { ViewportSlice } from "./slices/viewport-slice.ts";
import { CursorSlice } from "./slices/cursor-slice.ts";
import { SelectionSlice } from "./slices/selection-slice.ts";
import { HistorySlice } from "./slices/history-slice.ts";
import { BoxSelectionSlice } from "./slices/box-selection-slice.ts";
import { ToolSlice } from "./slices/tool-slice.ts";
import { TimingSlice } from "./slices/timing-slice.ts";
import { ColumnsSlice } from "./slices/columns-slice.ts";
import { TimingColumnsSlice } from "./slices/timing-columns-slice.ts";
import { LevelColumnsSlice } from "./slices/level-columns-slice.ts";
import { SoundColumnsSlice } from "./slices/sound-columns-slice.ts";
import { GameModeRegistrySlice } from "./slices/game-mode-registry-slice.ts";
import { RenderSlice } from "./slices/render-slice.ts";
import { PointerInteractionSlice } from "./slices/pointer-interaction-slice.ts";
import { DragSlice } from "./slices/drag-slice.ts";
import { ViewCommandSlice } from "./slices/view-command-slice.ts";
import { EditorCommandSlice } from "./slices/editor-command-slice.ts";
import { ClipperSlice } from "./slices/clipper-slice.ts";
import { SoundChannelSlice } from "./slices/sound-channel-slice.ts";
import { WaveformSlice } from "./slices/waveform-slice.ts";
import { PlaybackSlice } from "./slices/playback-slice.ts";
import type { GameModeLayout } from "./lane-layouts.ts";
import type { ExtensionHost, PropertySet, ColoringRule } from "../extensions/index.ts";
import { SetMetadataUserAction } from "./user-actions.ts";
import type { ProjectFile, ProjectMetadata } from "../project-format/index.ts";
import { createPlayback } from "./create-playback.ts";
import { SOUND_EVENT, CHART_REF, EVENT, SOUND_CHANNEL, CHART } from "./components.ts";
import { DEFAULT_CHART_SIZE } from "./types.ts";

const SNAP_OPTIONS = ["1/4", "1/8", "1/12", "1/16", "1/24", "1/32", "1/48", "1/64"];

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

  get waveform(): WaveformSlice {
    return this.ctx.get(WaveformSlice);
  }

  get playback(): PlaybackSlice {
    return this.ctx.get(PlaybackSlice);
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
    this.ctx.register(GameModeRegistrySlice);
    this.ctx.register(TimingColumnsSlice);
    this.ctx.register(LevelColumnsSlice);
    this.ctx.register(SoundColumnsSlice);
    this.ctx.register(DragSlice);
    this.ctx.register(SoundChannelSlice);
    this.ctx.register(WaveformSlice);
    this.ctx.register(PlaybackSlice);
    this.ctx.register(RenderSlice);
    this.ctx.register(PointerInteractionSlice);
    this.ctx.register(ViewCommandSlice);
    this.ctx.register(EditorCommandSlice);
    this.ctx.register(ClipperSlice);

    this.ctx.get(ViewportSlice).onViewportChanged(() => {
      if (this.playback.$transportState.get() !== "playing") {
        this.pointer.recomputeCursorPulse();
      }
      this.render.requestRerender();
    });

    this.ctx.get(ViewportSlice).onScrollRequest((point) => {
      this.outbox.emit("setScroll", point);
    });

    this.ctx.get(PlaybackSlice).onPlayRequest((playback) => {
      this.outbox.emit("playbackPlay", playback, 1);
    });

    this.ctx.get(PlaybackSlice).onStopRequest((scrollY) => {
      this.outbox.emit("playbackStop", scrollY);
    });

    this.ctx.get(ToolSlice).onToolChanged(() => {
      this.render.requestRerender();
    });

    this.ctx.get(SnapSlice).onSnapChanged(() => {
      const currentPulse = this.cursor.$cursorPulse.get();
      const snapped = this.snapToGrid(currentPulse);
      this.cursor.$cursorPulse.set(snapped);
    });

    this.ctx.get(ColumnsSlice).$columns.subscribe(() => {
      this.render.requestRerender();
    });

    this.ctx.get(ColumnsSlice).refreshColumns();
  }

  playChart(cursorPulse: number, scrollY: number): void {
    const chartId = this.$selectedChartId.get();
    if (!chartId) return;

    const chartEntity = this.entityManager.get(chartId);
    const chartSize =
      this.entityManager.getComponent(chartEntity!, CHART)?.size ?? DEFAULT_CHART_SIZE;
    this.playback.setChartEndPulse(chartSize);

    const timingEngine = this.getTimingEngine();

    const soundEvents = this.entityManager
      .entitiesWithComponent(SOUND_EVENT)
      .filter((e) => {
        const ref = this.entityManager.getComponent(e, CHART_REF);
        return ref?.chartId === chartId;
      })
      .map((e) => {
        const event = this.entityManager.getComponent(e, EVENT);
        const se = this.entityManager.getComponent(e, SOUND_EVENT);
        return {
          entityId: e.id,
          pulse: event!.y,
          soundLane: se!.soundLane,
          soundChannelId: se!.soundChannelId,
          command: se!.command,
        };
      });

    const channels = new Map<string, { path: string; durationSec: number }>();
    for (const e of this.entityManager.entitiesWithComponent(SOUND_EVENT)) {
      const cr = this.entityManager.getComponent(e, CHART_REF);
      if (!cr || cr.chartId !== chartId) continue;
      const se = this.entityManager.getComponent(e, SOUND_EVENT);
      if (!se) continue;
      const channelId = se.soundChannelId;
      if (channels.has(channelId)) continue;
      const channelEntity = this.entityManager.get(channelId);
      const sc = channelEntity
        ? this.entityManager.getComponent(channelEntity, SOUND_CHANNEL)
        : undefined;
      if (!sc?.path) continue;
      const waveformData = this.waveform.$waveformData.get().get(sc.path);
      const durationSec = waveformData?.durationSec ?? 0;
      channels.set(channelId, { path: sc.path, durationSec });
    }

    const abortController = this.playback.newAbortController();

    const playback = createPlayback({
      soundEvents,
      timingEngine,
      cursorPulse,
      channels,
      abortController,
      onPulseUpdate: (pulse) => {
        this.playback.setPlaybackPulse(pulse);
        this.cursor.$cursorPulse.set(pulse);

        if (pulse > chartSize) {
          this.stopPlayback();
          return;
        }

        const scaleY = 0.2 * this.$zoom.get();
        const contentHeight = this.getContentHeight();
        const playheadContentY = contentHeight - pulse * scaleY;
        const viewportHeight = this.getViewportHeight();
        const targetScrollY = playheadContentY - viewportHeight * 0.4;
        this.outbox.emit("setScroll", { x: 0, y: Math.max(0, targetScrollY) });
      },
    });
    this.playback.play(playback, cursorPulse, scrollY);
  }

  pausePlayback(): void {
    this.playback.pause();
  }

  stopPlayback(): void {
    this.playback.stop();
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

  getViewportHeight(): number {
    return this.viewport.$viewportSize.get().height;
  }

  getScrollY(): number {
    return this.viewport.$scroll.get().y;
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

  snapIncrease(): void {
    const current = this.$snap.get();
    const index = SNAP_OPTIONS.indexOf(current);
    const nextIndex = index === -1 ? 0 : (index + 1) % SNAP_OPTIONS.length;
    this.setSnap(SNAP_OPTIONS[nextIndex]);
  }

  snapDecrease(): void {
    const current = this.$snap.get();
    const index = SNAP_OPTIONS.indexOf(current);
    const prevIndex =
      index === -1
        ? SNAP_OPTIONS.length - 1
        : (index - 1 + SNAP_OPTIONS.length) % SNAP_OPTIONS.length;
    this.setSnap(SNAP_OPTIONS[prevIndex]);
  }

  placeAtCursor(): void {
    this.pointer.placeAtCursor();
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

  async copySelection(): Promise<void> {
    await this.ctx.get(ClipperSlice).copySelection();
  }

  async paste(): Promise<void> {
    await this.ctx.get(ClipperSlice).paste();
  }

  async cutSelection(): Promise<void> {
    await this.ctx.get(ClipperSlice).cutSelection();
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

  navigateColumn(direction: "left" | "right"): void {
    this.ctx.get(ViewCommandSlice).navigateColumn(direction);
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

  getChartSizeQuarterNotes(): number {
    return this.ctx.get(ChartSlice).getChartSizeQuarterNotes();
  }

  getMaxEventPulse(): number {
    return this.ctx.get(ChartSlice).getMaxEventPulse();
  }

  setChartSize(pulses: number): void {
    this.ctx.get(ChartSlice).setChartSize(pulses);
  }

  getGameModes(): GameModeLayout[] {
    return this.ctx.get(GameModeRegistrySlice).getAllModes();
  }

  createExtensionHost(): ExtensionHost {
    const registry = this.ctx.get(GameModeRegistrySlice);
    return {
      registerGameMode(layout: GameModeLayout) {
        registry.registerGameMode(layout);
      },
      registerPropertySet(id: string, propertySet: PropertySet) {
        registry.registerPropertySet(id, propertySet);
      },
      registerColoringRule(rule: ColoringRule) {
        registry.registerColoringRule(rule);
      },
    };
  }

  addSoundGroup(name?: string): string {
    return this.ctx.get(SoundChannelSlice).addSoundGroup(name);
  }

  addSoundChannel(groupId: string): string {
    return this.ctx.get(SoundChannelSlice).addSoundChannel(groupId);
  }

  removeSoundChannel(id: string): void {
    this.ctx.get(SoundChannelSlice).removeSoundChannel(id);
  }

  removeSoundGroup(id: string): void {
    this.ctx.get(SoundChannelSlice).removeSoundGroup(id);
  }

  setSelectedSoundChannelId(id: string | null): void {
    this.ctx.get(SoundChannelSlice).setSelectedSoundChannelId(id);
  }

  getMetadata(): ProjectMetadata {
    return this.ctx.get(ProjectSlice).$metadata.get();
  }

  setMetadataField(field: keyof ProjectMetadata, value: string): void {
    const projectSlice = this.ctx.get(ProjectSlice);
    const oldMetadata = projectSlice.$metadata.get();
    const newMetadata = { ...oldMetadata, [field]: value };
    this.ctx
      .get(HistorySlice)
      .applyAction(new SetMetadataUserAction(this.ctx, oldMetadata, newMetadata));
  }

  serialize(): ProjectFile {
    const projectSlice = this.ctx.get(ProjectSlice);
    return {
      schemaVersion: 2,
      version: uuidv7(),
      metadata: projectSlice.$metadata.get(),
      entities: projectSlice.entityManager.toArray(),
    };
  }
}
