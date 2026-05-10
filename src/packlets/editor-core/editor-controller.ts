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
import { uuidv7 } from "uuidv7";
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
import { GameModeRegistrySlice } from "./slices/game-mode-registry-slice";
import { RenderSlice } from "./slices/render-slice";
import { PointerInteractionSlice } from "./slices/pointer-interaction-slice";
import { DragSlice } from "./slices/drag-slice";
import { ViewCommandSlice } from "./slices/view-command-slice";
import { EditorCommandSlice } from "./slices/editor-command-slice";
import { SoundChannelSlice } from "./slices/sound-channel-slice";
import { WaveformSlice } from "./slices/waveform-slice";
import { PlaybackSlice } from "./slices/playback-slice";
import type { GameModeLayout } from "./lane-layouts";
import { BEAT_5K_LAYOUT, BEAT_7K_LAYOUT } from "./lane-layouts";
import { SetMetadataUserAction } from "./user-actions";
import type { ProjectFile, ProjectMetadata } from "../project-format";
import { createPlayback } from "./create-playback";
import { SOUND_EVENT, CHART_REF, EVENT, SOUND_CHANNEL, CHART } from "./components";
import { DEFAULT_CHART_SIZE } from "./types";

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
    this.ctx.get(GameModeRegistrySlice).registerGameMode(BEAT_5K_LAYOUT);
    this.ctx.get(GameModeRegistrySlice).registerGameMode(BEAT_7K_LAYOUT);
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

  getGameModes(): GameModeLayout[] {
    return this.ctx.get(GameModeRegistrySlice).getAllModes();
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
