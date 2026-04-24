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

export interface EditorControllerOptions {
  project: ProjectFile;
}

export interface TimelineColumn {
  id: string;
  title: string;
  width: number;
  x: number;
  backgroundColor?: string;
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

    // Trailing line after last column.
    const width = x + 1;
    return { columns, width };
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
    const bpmChanges = this.entityManager
      .entitiesWithComponent(BPM_CHANGE)
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
