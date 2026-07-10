import { Slice } from "../slice.ts";
import type { EditorContext } from "../editor-context.ts";
import { ColumnsSlice } from "./columns-slice.ts";
import { ChartSlice } from "./chart-slice.ts";
import { LevelSlice } from "./level-slice.ts";
import { GameModeRegistrySlice } from "./game-mode-registry-slice.ts";
import { EVENT, NOTE, SOFLAN, LEVEL_REF, CHART_REF } from "../components.ts";
import { EntityBuilder } from "../../entity-manager/index.ts";
import type { ColumnDefinition } from "../types.ts";
import { getNoteColumn } from "../entity-accessors.ts";

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
    if (chartId === null || chartId === "") return [];

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
          affinity: "gameplay" as const,
          containsEntity: (entity) => {
            const col = getNoteColumn(entity);
            return col?.levelId === level.id && col?.laneIndex === lane.laneIndex;
          },
          placementHandler: (pulse) => {
            const builder = new EntityBuilder()
              .with(EVENT, { y: pulse })
              .with(NOTE, { lane: lane.laneIndex })
              .with(LEVEL_REF, { levelId: level.id })
              .with(CHART_REF, { chartId });
            if (layout.defaultComponents) {
              for (const [key, value] of Object.entries(layout.defaultComponents)) {
                builder.withComponent(key, value);
              }
            }
            return builder.build();
          },
          moveEntityTo: (batch, _em, entity) => {
            batch.setNoteColumn(entity.id, level.id, lane.laneIndex);
          },
        });
      }
      if (layout.supportsSoflan === true) {
        defs.push({
          id: `soflan-${level.id}`,
          title: "S",
          width: 48,
          levelId: level.id,
          backgroundColor: "var(--gray-2)",
          containsEntity: (entity) => {
            const lr = (entity.components as Record<string, { levelId: string } | undefined>)[
              LEVEL_REF.key
            ];
            return lr?.levelId === level.id && entity.components[SOFLAN.key] !== undefined;
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
    }

    return defs;
  }
}
