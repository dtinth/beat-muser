/**
 * @packageDocumentation
 *
 * Central state brain for the beatmap editor. React is a dumb view layer;
 * this packlet owns all editor-relevant state, model data, and interaction logic.
 */

import { atom } from "nanostores";
import type { ProjectFile } from "../project-format";
import { EntityManager, type Entity } from "../entity-manager";
import { createTimingEngine } from "../timing-engine";
import type { TimingEngine } from "../timing-engine";
import {
  EVENT,
  CHART,
  BPM_CHANGE,
  TIME_SIGNATURE,
  CHART_REF,
  LEVEL_REF,
  LEVEL,
  NOTE,
  KEYSOUND,
  SOUND_GROUP,
  SOUND_CHANNEL,
  SOUND_EVENT,
} from "./components";
import { getGameModeLayout } from "./lane-layouts";

export interface EditorControllerOptions {
  project: ProjectFile;
}

export interface TimelineColumn {
  id: string;
  title: string;
  width: number;
  x: number;
  backgroundColor?: string;
  levelId?: string;
  laneIndex?: number;
}

export interface LevelInfo {
  id: string;
  name: string;
  mode: string;
  sortOrder: number;
  visible: boolean;
}

const DEFAULT_CHART_SIZE = 15360;

export {
  EVENT,
  CHART,
  BPM_CHANGE,
  TIME_SIGNATURE,
  CHART_REF,
  LEVEL_REF,
  LEVEL,
  NOTE,
  KEYSOUND,
  SOUND_GROUP,
  SOUND_CHANNEL,
  SOUND_EVENT,
};

const ZOOM_PRESETS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4];
const BASE_SCALE_Y = 0.2;

export class EditorController {
  $selectedChartId = atom<string | null>(null);
  $cursorPulse = atom<number>(0);
  $snap = atom<string>("1/16");
  $zoom = atom<number>(1); // zoom multiplier, 1 = 100%
  $visibleLevelIds = atom<Set<string>>(new Set());

  private entityManager: EntityManager;
  private columns: TimelineColumn[];
  private timelineWidth: number;

  constructor(options: EditorControllerOptions) {
    this.entityManager = EntityManager.from(options.project.entities);

    const charts = this.entityManager.entitiesWithComponent(CHART);
    if (charts.length > 0) {
      this.$selectedChartId.set(charts[0]!.id);
    } else {
      const chartId = this.createDefaultChart();
      this.$selectedChartId.set(chartId);
    }

    // Show all existing levels by default.
    const chartId = this.$selectedChartId.get();
    if (chartId) {
      const levelIds = this.getLevelsForChart(chartId).map((l) => l.id);
      this.$visibleLevelIds.set(new Set(levelIds));
    }

    const { columns, width } = this.computeColumns();
    this.columns = columns;
    this.timelineWidth = width;
  }

  private computeColumns(): { columns: TimelineColumn[]; width: number } {
    const defs = [
      { id: "measure", title: "", width: 40 },
      { id: "time-sig", title: "Time", width: 48 },
      { id: "bpm", title: "BPM", width: 56 },
    ];

    let x = 0;
    const columns: TimelineColumn[] = [];
    for (const def of defs) {
      columns.push({ ...def, x });
      x += def.width;
    }

    // Add gameplay lanes for visible levels.
    const chartId = this.$selectedChartId.get();
    if (chartId) {
      const visibleLevels = this.getVisibleLevels();
      for (const level of visibleLevels) {
        const layout = getGameModeLayout(level.mode);
        if (!layout) continue;
        for (let i = 0; i < layout.lanes.length; i++) {
          const lane = layout.lanes[i];
          columns.push({
            id: `level-${level.id}-lane-${i}`,
            title: lane.name,
            width: lane.width,
            x,
            backgroundColor: lane.backgroundColor,
            levelId: level.id,
            laneIndex: i,
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

  private createDefaultChart(): string {
    const id = `chart-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const chart: Entity = {
      id,
      version: id,
      components: {
        chart: { name: "Untitled", size: DEFAULT_CHART_SIZE },
      },
    };
    this.entityManager.insert(chart);
    return id;
  }

  getLevelsForChart(chartId: string): LevelInfo[] {
    return this.entityManager
      .entitiesWithComponent(LEVEL)
      .filter((entity) => {
        const ref = this.entityManager.getComponent(entity, CHART_REF);
        return ref?.chartId === chartId;
      })
      .map((entity) => {
        const level = this.entityManager.getComponent(entity, LEVEL);
        const visible = this.$visibleLevelIds.get().has(entity.id);
        return {
          id: entity.id,
          name: level?.name ?? "Untitled",
          mode: level?.mode ?? "beat-7k",
          sortOrder: level?.sortOrder ?? 0,
          visible,
        };
      })
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  getVisibleLevels(): LevelInfo[] {
    const chartId = this.$selectedChartId.get();
    if (!chartId) return [];
    return this.getLevelsForChart(chartId).filter((l) => l.visible);
  }

  addLevel(chartId: string, name: string, mode: string): string {
    const existing = this.getLevelsForChart(chartId);
    const maxOrder = existing.length > 0 ? Math.max(...existing.map((l) => l.sortOrder)) : -1;
    const id = `level-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const level: Entity = {
      id,
      version: id,
      components: {
        level: { name, mode, sortOrder: maxOrder + 1 },
        chartRef: { chartId },
      },
    };
    this.entityManager.insert(level);
    this.$visibleLevelIds.set(new Set([...this.$visibleLevelIds.get(), id]));
    this.refreshColumns();
    return id;
  }

  removeLevel(levelId: string): void {
    this.entityManager.remove(levelId);
    const visible = new Set(this.$visibleLevelIds.get());
    visible.delete(levelId);
    this.$visibleLevelIds.set(visible);
    this.refreshColumns();
  }

  toggleLevelVisibility(levelId: string): void {
    const visible = new Set(this.$visibleLevelIds.get());
    if (visible.has(levelId)) {
      visible.delete(levelId);
    } else {
      visible.add(levelId);
    }
    this.$visibleLevelIds.set(visible);
    this.refreshColumns();
  }

  getScaleY(): number {
    return BASE_SCALE_Y * this.$zoom.get();
  }

  setZoom(zoom: number): void {
    this.$zoom.set(zoom);
  }

  zoomIn(): void {
    const current = this.$zoom.get();
    const next = ZOOM_PRESETS.find((z) => z > current);
    if (next) this.$zoom.set(next);
  }

  zoomOut(): void {
    const current = this.$zoom.get();
    const prev = [...ZOOM_PRESETS].reverse().find((z) => z < current);
    if (prev) this.$zoom.set(prev);
  }

  /**
   * Computes the new scroll top after a zoom change so that the playhead
   * stays at the same viewport Y position.
   *
   * @param oldZoom The zoom level before the change.
   * @param oldScrollTop The scroll top before the change.
   * @returns The new scroll top to apply.
   */
  computeZoomScrollOffset(oldZoom: number, oldScrollTop: number): number {
    const newZoom = this.$zoom.get();
    const size = this.getChartSize();
    const oldScaleY = BASE_SCALE_Y * oldZoom;
    const newScaleY = BASE_SCALE_Y * newZoom;
    const cursorPulse = this.$cursorPulse.get();
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
    const id = this.$selectedChartId.get();
    if (!id) return undefined;
    return this.entityManager.get(id);
  }

  getChartSize(): number {
    const chart = this.getSelectedChart();
    const chartComponent = chart ? this.entityManager.getComponent(chart, CHART) : undefined;
    return chartComponent?.size ?? DEFAULT_CHART_SIZE;
  }

  snapToGrid(pulse: number): number {
    return this.getTimingEngine().snapPulse(pulse, this.$snap.get());
  }

  getTimingEngine(): TimingEngine {
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

    return createTimingEngine(bpmChanges, timeSignatures);
  }

  getColumns(): TimelineColumn[] {
    return this.columns;
  }

  getTimelineWidth(): number {
    return this.timelineWidth;
  }
}
