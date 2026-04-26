import { atom } from "nanostores";
import { Slice } from "../slice";
import type { EditorContext } from "../editor-context";
import { ProjectSlice } from "./project-slice";
import { CHART } from "../components";
import { DEFAULT_CHART_SIZE } from "../types";
import type { Entity } from "../../entity-manager";

export class ChartSlice extends Slice {
  static readonly sliceKey = "chart";

  $selectedChartId = atom<string | null>(null);

  constructor(ctx: EditorContext) {
    super(ctx);
    const charts = this.getCharts();
    if (charts.length > 0) {
      this.$selectedChartId.set(charts[0]!.id);
    }
  }

  getCharts(): Entity[] {
    return this.ctx.get(ProjectSlice).entityManager.entitiesWithComponent(CHART);
  }

  getSelectedChart(): Entity | undefined {
    const id = this.$selectedChartId.get();
    if (!id) return undefined;
    return this.ctx.get(ProjectSlice).entityManager.get(id);
  }

  getChartSize(): number {
    const chart = this.getSelectedChart();
    const chartComponent = chart
      ? this.ctx.get(ProjectSlice).entityManager.getComponent(chart, CHART)
      : undefined;
    return chartComponent?.size ?? DEFAULT_CHART_SIZE;
  }

  setSelectedChartId(id: string | null): void {
    this.$selectedChartId.set(id);
  }
}
