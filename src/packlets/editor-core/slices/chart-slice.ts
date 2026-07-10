import { atom } from "nanostores";
import { Slice } from "../slice.ts";
import type { EditorContext } from "../editor-context.ts";
import { ProjectSlice } from "./project-slice.ts";
import { HistorySlice } from "./history-slice.ts";
import { CHART, EVENT, CHART_REF } from "../components.ts";
import {
  DEFAULT_CHART_SIZE,
  PPQN,
  QUARTER_NOTE_EXTEND_SIZE,
  AUTO_EXTEND_THRESHOLD_QN,
} from "../types.ts";
import { EntityBuilder } from "../../entity-manager/index.ts";
import type { Entity } from "../../entity-manager/index.ts";
import {
  InsertEntityUserAction,
  DeleteEntityUserAction,
  EditEntityUserAction,
} from "../user-actions.ts";

export class ChartSlice extends Slice {
  static readonly sliceKey = "chart";

  $selectedChartId = atom<string | null>(null);

  constructor(ctx: EditorContext) {
    super(ctx);
    const charts = this.getCharts();
    if (charts.length > 0) {
      this.$selectedChartId.set(charts[0].id);
    }
    this.setupAutoExtend();
  }

  private setupAutoExtend(): void {
    const em = this.ctx.get(ProjectSlice).entityManager;
    em.$mutationVersion.subscribe(() => {
      const chartSize = this.getChartSize();
      const maxPulse = this.getMaxEventPulse();
      if (maxPulse <= chartSize) return;

      const diffQn = (maxPulse - chartSize) / PPQN;
      let newSizePulses: number;
      if (diffQn <= AUTO_EXTEND_THRESHOLD_QN) {
        newSizePulses = chartSize + QUARTER_NOTE_EXTEND_SIZE * PPQN;
      } else {
        const totalQn = maxPulse / PPQN;
        const roundedQn = Math.ceil(totalQn / QUARTER_NOTE_EXTEND_SIZE) * QUARTER_NOTE_EXTEND_SIZE;
        newSizePulses = roundedQn * PPQN;
      }
      this.setChartSize(newSizePulses);
    });
  }

  getCharts(): Entity[] {
    return this.ctx.get(ProjectSlice).entityManager.entitiesWithComponent(CHART);
  }

  getSelectedChart(): Entity | undefined {
    const id = this.$selectedChartId.get();
    if (id === null || id === "") return undefined;
    return this.ctx.get(ProjectSlice).entityManager.get(id);
  }

  getChartSize(): number {
    const chart = this.getSelectedChart();
    const chartComponent = chart
      ? this.ctx.get(ProjectSlice).entityManager.getComponent(chart, CHART)
      : undefined;
    return chartComponent?.size ?? DEFAULT_CHART_SIZE;
  }

  getChartSizeQuarterNotes(): number {
    return this.getChartSize() / PPQN;
  }

  setChartSize(pulses: number): void {
    const chart = this.getSelectedChart();
    if (!chart) return;
    const chartComponent = this.ctx.get(ProjectSlice).entityManager.getComponent(chart, CHART);
    const oldComponents = structuredClone(chart.components);
    const newComponents = structuredClone(chart.components);
    newComponents[CHART.key] = { ...chartComponent, size: pulses };
    this.ctx
      .get(HistorySlice)
      .applyAction(new EditEntityUserAction(this.ctx, chart.id, oldComponents, newComponents));
  }

  getMaxEventPulse(): number {
    const chartId = this.$selectedChartId.get();
    if (chartId === null || chartId === "") return 0;
    const em = this.ctx.get(ProjectSlice).entityManager;
    let maxPulse = 0;
    for (const entity of em.entitiesWithComponent(EVENT)) {
      const ref = em.getComponent(entity, CHART_REF);
      if (ref?.chartId !== chartId) continue;
      const event = em.getComponent(entity, EVENT);
      if (event && event.y > maxPulse) {
        maxPulse = event.y;
      }
    }
    return maxPulse;
  }

  setSelectedChartId(id: string | null): void {
    this.$selectedChartId.set(id);
  }

  addChart(
    name: string = "New Chart",
    size: number = DEFAULT_CHART_SIZE,
    soundLanes: number = 1,
  ): string {
    const chart = new EntityBuilder().with(CHART, { name, size, soundLanes }).build();
    const previousSelectedChartId = this.$selectedChartId.get();
    this.ctx.get(HistorySlice).applyAction(
      new InsertEntityUserAction(
        this.ctx,
        chart,
        () => {
          this.$selectedChartId.set(chart.id);
        },
        () => {
          this.$selectedChartId.set(previousSelectedChartId);
        },
      ),
    );
    return chart.id;
  }

  removeChart(chartId: string): void {
    const em = this.ctx.get(ProjectSlice).entityManager;
    const entity = em.get(chartId);
    if (!entity) return;
    const previousSelectedChartId = this.$selectedChartId.get();
    this.ctx.get(HistorySlice).applyAction(
      new DeleteEntityUserAction(
        this.ctx,
        chartId,
        structuredClone(entity),
        () => {
          if (this.$selectedChartId.get() === chartId) {
            const remaining = this.getCharts();
            this.$selectedChartId.set(remaining.length > 0 ? remaining[0].id : null);
          }
        },
        () => {
          this.$selectedChartId.set(previousSelectedChartId);
        },
      ),
    );
  }
}
