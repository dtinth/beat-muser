import { Slice } from "../slice";
import type { EditorContext } from "../editor-context";
import { ProjectSlice } from "./project-slice";
import { ChartSlice } from "./chart-slice";
import { createTimingEngine } from "../../timing-engine";
import type { TimingEngine } from "../../timing-engine";
import { EVENT, BPM_CHANGE, TIME_SIGNATURE, CHART_REF } from "../components";

export class TimingSlice extends Slice {
  static readonly sliceKey = "timing";

  private cache: TimingEngine | null = null;
  private cacheVersion = 0;

  constructor(ctx: EditorContext) {
    super(ctx);
  }

  getTimingEngine(): TimingEngine {
    const em = this.ctx.get(ProjectSlice).entityManager;
    const currentVersion = em.getMutationVersion();
    if (this.cache && this.cacheVersion === currentVersion) {
      return this.cache;
    }

    const chartId = this.ctx.get(ChartSlice).$selectedChartId.get();

    const bpmChanges = em
      .entitiesWithComponent(BPM_CHANGE)
      .filter((entity) => {
        if (!chartId) return true;
        const ref = em.getComponent(entity, CHART_REF);
        return !ref || ref.chartId === chartId;
      })
      .map((entity) => {
        const event = em.getComponent(entity, EVENT);
        const bpm = em.getComponent(entity, BPM_CHANGE);
        return {
          pulse: event?.y ?? 0,
          bpm: bpm?.bpm ?? 60,
        };
      })
      .sort((a, b) => a.pulse - b.pulse);

    const timeSignatures = em
      .entitiesWithComponent(TIME_SIGNATURE)
      .filter((entity) => {
        if (!chartId) return true;
        const ref = em.getComponent(entity, CHART_REF);
        return !ref || ref.chartId === chartId;
      })
      .map((entity) => {
        const event = em.getComponent(entity, EVENT);
        const ts = em.getComponent(entity, TIME_SIGNATURE);
        return {
          pulse: event?.y ?? 0,
          numerator: ts?.numerator ?? 4,
          denominator: ts?.denominator ?? 4,
        };
      })
      .sort((a, b) => a.pulse - b.pulse);

    const engine = createTimingEngine(bpmChanges, timeSignatures);
    this.cache = engine;
    this.cacheVersion = currentVersion;
    return engine;
  }
}
