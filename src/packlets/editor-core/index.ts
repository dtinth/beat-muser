/**
 * @packageDocumentation
 *
 * Central state brain for the beatmap editor. React is a dumb view layer;
 * this packlet owns all editor-relevant state, model data, and interaction logic.
 */

import { atom } from "nanostores";
import type { ProjectFile, Entity } from "../project-format";
import { createTimingEngine } from "../timing-engine";
import type { TimingEngine } from "../timing-engine";

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

export class EditorController {
  $entities = atom<Map<string, Entity>>(new Map());
  $selectedChartId = atom<string | null>(null);

  private columns: TimelineColumn[];
  private timelineWidth: number;

  constructor(options: EditorControllerOptions) {
    const map = new Map<string, Entity>();
    for (const entity of options.project.entities) {
      map.set(entity.id, entity);
    }
    this.$entities.set(map);

    const charts = Array.from(map.values()).filter((e) => e.components.chart);
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
        chart: { name: "Untitled", mode: "7k", size: DEFAULT_CHART_SIZE },
      },
    };
    const map = this.$entities.get();
    map.set(id, chart);
    this.$entities.set(new Map(map));
    return id;
  }

  getSelectedChart(): Entity | undefined {
    const id = this.$selectedChartId.get();
    if (!id) return undefined;
    return this.$entities.get().get(id);
  }

  getChartSize(): number {
    const chart = this.getSelectedChart();
    const chartComponent = chart?.components.chart as { size?: number } | undefined;
    return chartComponent?.size ?? DEFAULT_CHART_SIZE;
  }

  getTimingEngine(): TimingEngine {
    // TODO: extract bpmChanges and timeSignatures from entities
    return createTimingEngine([], []);
  }

  getColumns(): TimelineColumn[] {
    return this.columns;
  }

  getTimelineWidth(): number {
    return this.timelineWidth;
  }
}
