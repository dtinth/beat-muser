import { Slice } from "../slice";
import type { EditorContext } from "../editor-context";
import { ColumnsSlice } from "./columns-slice";
import { ChartSlice } from "./chart-slice";
import { LevelSlice } from "./level-slice";
import { GameModeRegistrySlice } from "./game-mode-registry-slice";
import { EVENT, NOTE, LEVEL_REF, CHART_REF } from "../components";
import { EntityBuilder } from "../../entity-manager";
import type { ColumnDefinition } from "../types";

export class LevelColumnsSlice extends Slice {
  static readonly sliceKey = "level-columns";

  constructor(ctx: EditorContext) {
    super(ctx);

    const columns = ctx.get(ColumnsSlice);
    columns.registerColumnProvider(2, () => this.getColumns());

    ctx.get(ChartSlice).$selectedChartId.subscribe(() => {
      columns.refreshColumns();
    });

    ctx.get(LevelSlice).onLevelsChanged(() => {
      columns.refreshColumns();
    });

    ctx.get(GameModeRegistrySlice).$modes.subscribe(() => {
      columns.refreshColumns();
    });
  }

  getColumns(): ColumnDefinition[] {
    const chartId = this.ctx.get(ChartSlice).$selectedChartId.get();
    if (!chartId) return [];

    const registry = this.ctx.get(GameModeRegistrySlice);
    const visibleLevels = this.ctx.get(LevelSlice).getVisibleLevels(chartId);
    const defs: ColumnDefinition[] = [];

    for (const level of visibleLevels) {
      defs.push({ id: `spacer-level-${level.id}`, title: "", width: 8 });
      const layout = registry.getGameModeLayout(level.mode);
      if (!layout) continue;
      for (const lane of layout.lanes) {
        defs.push({
          id: `level-${level.id}-lane-${lane.laneIndex}`,
          title: lane.name,
          width: lane.width,
          backgroundColor: lane.backgroundColor,
          noteColor: lane.noteColor,
          levelId: level.id,
          laneIndex: lane.laneIndex,
          placementHandler: (pulse) => {
            return new EntityBuilder()
              .with(EVENT, { y: pulse })
              .with(NOTE, { lane: lane.laneIndex })
              .with(LEVEL_REF, { levelId: level.id })
              .with(CHART_REF, { chartId })
              .build();
          },
        });
      }
    }

    return defs;
  }
}
