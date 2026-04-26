import { Slice } from "../slice";
import type { EditorContext } from "../editor-context";
import { ColumnsSlice } from "./columns-slice";
import { ChartSlice } from "./chart-slice";
import { TimingSlice } from "./timing-slice";
import { EVENT, TIME_SIGNATURE, BPM_CHANGE, CHART_REF } from "../components";
import { EntityBuilder } from "../../entity-manager";
import type { ColumnDefinition } from "../types";

export class TimingColumnsSlice extends Slice {
  static readonly sliceKey = "timing-columns";

  constructor(ctx: EditorContext) {
    super(ctx);
    ctx.get(ColumnsSlice).registerColumnProvider(1, () => this.getColumns());
  }

  getColumns(): ColumnDefinition[] {
    return [
      { id: "measure", title: "", width: 40 },
      {
        id: "time-sig",
        title: "Time",
        width: 48,
        placementHandler: (pulse) => {
          const chartId = this.ctx.get(ChartSlice).$selectedChartId.get();
          if (!chartId) return null;
          const ts = this.ctx.get(TimingSlice).getTimingEngine().getTimeSignatureAtPulse(pulse);
          return new EntityBuilder()
            .with(EVENT, { y: pulse })
            .with(TIME_SIGNATURE, { numerator: ts.numerator, denominator: ts.denominator })
            .with(CHART_REF, { chartId })
            .build();
        },
      },
      {
        id: "bpm",
        title: "BPM",
        width: 56,
        placementHandler: (pulse) => {
          const chartId = this.ctx.get(ChartSlice).$selectedChartId.get();
          if (!chartId) return null;
          const bpm = this.ctx.get(TimingSlice).getTimingEngine().getBpmAtPulse(pulse);
          return new EntityBuilder()
            .with(EVENT, { y: pulse })
            .with(BPM_CHANGE, { bpm })
            .with(CHART_REF, { chartId })
            .build();
        },
      },
      { id: "spacer", title: "", width: 8 },
    ];
  }
}
