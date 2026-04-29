import { Slice } from "../slice";
import type { EditorContext } from "../editor-context";
import { ColumnsSlice } from "./columns-slice";
import { ChartSlice } from "./chart-slice";
import { ProjectSlice } from "./project-slice";
import { CHART } from "../components";
import type { ColumnDefinition } from "../types";

export class SoundColumnsSlice extends Slice {
  static readonly sliceKey = "sound-columns";

  constructor(ctx: EditorContext) {
    super(ctx);
    ctx.get(ColumnsSlice).registerColumnProvider(3, () => this.getColumns());

    ctx.get(ChartSlice).$selectedChartId.subscribe(() => {
      ctx.get(ColumnsSlice).refreshColumns();
    });
  }

  getColumns(): ColumnDefinition[] {
    const chart = this.ctx.get(ChartSlice).getSelectedChart();
    if (!chart) return [];

    const chartComponent = this.ctx.get(ProjectSlice).entityManager.getComponent(chart, CHART);
    const soundLaneCount = chartComponent?.soundLanes ?? 1;

    const defs: ColumnDefinition[] = [];
    if (soundLaneCount > 0) {
      defs.push({ id: "spacer-sound", title: "", width: 8 });
    }
    for (let i = 0; i < soundLaneCount; i++) {
      defs.push({
        id: `sound-lane-${i}`,
        title: `Sound ${i + 1}`,
        width: 100,
        backgroundColor: "var(--gray-2)",
        soundLane: i,
      });
    }
    return defs;
  }
}
