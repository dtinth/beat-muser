import { Slice } from "../slice.ts";
import type { EditorContext } from "../editor-context.ts";
import { SelectionSlice } from "./selection-slice.ts";
import { ProjectSlice } from "./project-slice.ts";
import { HistorySlice } from "./history-slice.ts";
import { CursorSlice } from "./cursor-slice.ts";
import { ChartSlice } from "./chart-slice.ts";
import type { Entity } from "../../entity-manager/index.ts";
import { BPM_CHANGE, EVENT, CHART_REF } from "../components.ts";
import { DeleteUserAction, BatchEditEntitiesUserAction } from "../user-actions.ts";

export class EditorCommandSlice extends Slice {
  static readonly sliceKey = "editorCommand";

  constructor(ctx: EditorContext) {
    super(ctx);
  }

  deleteSelection(): void {
    const selection = this.ctx.get(SelectionSlice).$selection.get();
    if (selection.size === 0) return;

    const entityManager = this.ctx.get(ProjectSlice).entityManager;
    const entityIds = Array.from(selection);
    const entities = entityIds
      .map((id) => entityManager.get(id))
      .filter((e): e is Entity => e !== undefined)
      .map((e) => structuredClone(e));

    this.ctx.get(HistorySlice).applyAction(new DeleteUserAction(this.ctx, entityIds, entities));
  }

  /**
   * Adjust BPM by `delta`. Targets selected BPM-change events; if none are
   * selected, falls back to the BPM-change event currently in effect at the
   * cursor. No-op when there is no BPM event to edit.
   */
  nudgeBpm(delta: number): void {
    const em = this.ctx.get(ProjectSlice).entityManager;
    const chartId = this.ctx.get(ChartSlice).$selectedChartId.get();
    const inChart = (entity: Entity) => {
      if (!chartId) return true;
      const ref = em.getComponent(entity, CHART_REF);
      return !ref || ref.chartId === chartId;
    };

    let targets: Entity[] = [];

    const selection = this.ctx.get(SelectionSlice).$selection.get();
    if (selection.size > 0) {
      targets = Array.from(selection)
        .map((id) => em.get(id))
        .filter((e): e is Entity => e !== undefined && !!em.getComponent(e, BPM_CHANGE));
    }

    if (targets.length === 0) {
      const cursorPulse = this.ctx.get(CursorSlice).$cursorPulse.get();
      const governing = em
        .entitiesWithComponent(BPM_CHANGE)
        .filter((e) => inChart(e) && (em.getComponent(e, EVENT)?.y ?? 0) <= cursorPulse)
        .sort(
          (a, b) => (em.getComponent(b, EVENT)?.y ?? 0) - (em.getComponent(a, EVENT)?.y ?? 0),
        )[0];
      if (governing) targets = [governing];
    }

    if (targets.length === 0) return;

    const edits = targets.map((entity) => {
      const current = em.getComponent(entity, BPM_CHANGE)!;
      const newBpm = Math.max(1, current.bpm + delta);
      const oldComponents = structuredClone(entity.components);
      const newComponents = structuredClone(entity.components);
      newComponents[BPM_CHANGE.key] = { ...current, bpm: newBpm };
      return { entityId: entity.id, oldComponents, newComponents };
    });

    this.ctx.get(HistorySlice).applyAction(new BatchEditEntitiesUserAction(this.ctx, edits));
  }
}
