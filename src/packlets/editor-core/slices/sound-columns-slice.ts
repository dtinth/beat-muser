import { Slice } from "../slice";
import type { EditorContext } from "../editor-context";
import { ColumnsSlice } from "./columns-slice";
import { ChartSlice } from "./chart-slice";
import { ProjectSlice } from "./project-slice";
import { SoundChannelSlice } from "./sound-channel-slice";
import { CHART, EVENT, SOUND_EVENT, CHART_REF, KEYSOUND } from "../components";
import { EntityBuilder } from "../../entity-manager";
import type { ColumnDefinition } from "../types";
import type { EditBatchBuilder } from "../edit-batch-builder";
import type { EntityManager, Entity } from "../../entity-manager";
import { getPulse, getSoundLane } from "../entity-accessors";

export class SoundColumnsSlice extends Slice {
  static readonly sliceKey = "sound-columns";

  constructor(ctx: EditorContext) {
    super(ctx);
    ctx.get(ColumnsSlice).registerColumnProvider(3, () => this.getColumns());

    ctx.get(ChartSlice).$selectedChartId.subscribe(() => {
      ctx.get(ColumnsSlice).refreshColumns();
    });

    ctx.get(ProjectSlice).entityManager.$mutationVersion.subscribe(() => {
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
        affinity: "sound" as const,
        containsEntity: (entity) => getSoundLane(entity) === i,
        placementHandler: (pulse) => {
          const channelId = this.ctx.get(SoundChannelSlice).$selectedSoundChannelId.get();
          if (!channelId) return null;
          return new EntityBuilder()
            .with(EVENT, { y: pulse })
            .with(SOUND_EVENT, { soundLane: i, soundChannelId: channelId, command: "play" })
            .with(CHART_REF, { chartId: chart.id })
            .build();
        },
        moveEntityTo: (batch, em, entity) => {
          const oldSoundLane = getSoundLane(entity)!;
          batch.setSoundLane(entity.id, i);
          if (oldSoundLane !== i) {
            applyKeysoundCascade(batch, em, entity, oldSoundLane, i);
          }
        },
      });
    }
    return defs;
  }
}

function applyKeysoundCascade(
  batch: EditBatchBuilder,
  em: EntityManager,
  soundEntity: Entity,
  oldSoundLane: number,
  newSoundLane: number,
): void {
  const oldPulse = getPulse(soundEntity)!;
  const chartRef = soundEntity.components[CHART_REF.key] as { chartId: string } | undefined;
  if (!chartRef) return;
  for (const noteEntity of em.entitiesWithComponent(KEYSOUND)) {
    const ks = noteEntity.components[KEYSOUND.key] as { soundLane: number };
    if (ks.soundLane !== oldSoundLane) continue;
    if (getPulse(noteEntity) !== oldPulse) continue;
    const nr = noteEntity.components[CHART_REF.key] as { chartId: string } | undefined;
    if (nr?.chartId !== chartRef.chartId) continue;
    batch.setKeysoundLane(noteEntity.id, newSoundLane);
  }
}
