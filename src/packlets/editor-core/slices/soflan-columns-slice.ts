import { Slice } from "../slice.ts";
import type { EditorContext } from "../editor-context.ts";
import { ColumnsSlice } from "./columns-slice.ts";
import { ChartSlice } from "./chart-slice.ts";
import { LevelSlice } from "./level-slice.ts";
import { GameModeRegistrySlice } from "./game-mode-registry-slice.ts";
import { ProjectSlice } from "./project-slice.ts";
import { EVENT, SOFLAN, LEVEL_REF, CHART_REF } from "../components.ts";
import { EntityBuilder } from "../../entity-manager/index.ts";
import type { ColumnDefinition } from "../types.ts";

export class SoflanColumnsSlice extends Slice {
  static readonly sliceKey = "soflan-columns";

  constructor(ctx: EditorContext) {
    super(ctx);
    ctx.get(ColumnsSlice).registerColumnProvider(3.5, () => this.getColumns());

    ctx.get(ChartSlice).$selectedChartId.subscribe(() => {
      ctx.get(ColumnsSlice).refreshColumns();
    });

    ctx.get(LevelSlice).onLevelsChanged(() => {
      ctx.get(ColumnsSlice).refreshColumns();
    });

    ctx.get(GameModeRegistrySlice).$modes.subscribe(() => {
      ctx.get(ColumnsSlice).refreshColumns();
    });

    ctx.get(ProjectSlice).entityManager.$mutationVersion.subscribe(() => {
      ctx.get(ColumnsSlice).refreshColumns();
    });
  }

  getColumns(): ColumnDefinition[] {
    const chartId = this.ctx.get(ChartSlice).$selectedChartId.get();
    if (!chartId) return [];

    const registry = this.ctx.get(GameModeRegistrySlice);
    const visibleLevels = this.ctx.get(LevelSlice).getVisibleLevels(chartId);
    const defs: ColumnDefinition[] = [];

    for (const level of visibleLevels) {
      const layout = registry.getGameModeLayout(level.mode);
      if (!layout?.supportsSoflan) continue;
      defs.push({
        id: `soflan-${level.id}`,
        title: "S",
        width: 48,
        levelId: level.id,
        backgroundColor: "var(--gray-2)",
        containsEntity: (entity) => {
          const lr = entity.components[LEVEL_REF.key] as { levelId: string } | undefined;
          return lr?.levelId === level.id;
        },
        placementHandler: (pulse) => {
          return new EntityBuilder()
            .with(EVENT, { y: pulse })
            .with(SOFLAN, {
              scroll: { numerator: 1, denominator: 1 },
              skip: { numerator: 0, denominator: 1 },
            })
            .with(LEVEL_REF, { levelId: level.id })
            .with(CHART_REF, { chartId })
            .build();
        },
      });
    }

    return defs;
  }
}
