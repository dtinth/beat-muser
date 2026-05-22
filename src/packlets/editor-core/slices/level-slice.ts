import { atom } from "nanostores";
import { createNanoEvents } from "nanoevents";
import { Slice } from "../slice.ts";
import type { EditorContext } from "../editor-context.ts";
import { ProjectSlice } from "./project-slice.ts";
import { ChartSlice } from "./chart-slice.ts";
import { HistorySlice } from "./history-slice.ts";
import { CHART_REF, LEVEL } from "../components.ts";
import { EntityBuilder } from "../../entity-manager/index.ts";
import type { Entity } from "../../entity-manager/index.ts";
import type { LevelInfo } from "../types.ts";
import { InsertEntityUserAction, DeleteEntityUserAction } from "../user-actions.ts";

export class LevelSlice extends Slice {
  static readonly sliceKey = "level";

  $hiddenLevelIds = atom<Set<string>>(new Set());
  $selectedLevelId = atom<string | null>(null);
  private events = createNanoEvents<{ levelsChanged: () => void }>();

  constructor(ctx: EditorContext) {
    super(ctx);

    ctx.get(ChartSlice).$selectedChartId.subscribe((chartId) => {
      if (!chartId) {
        this.$selectedLevelId.set(null);
        return;
      }
      const levels = this.getLevelEntitiesForChart(chartId);
      const currentId = this.$selectedLevelId.get();
      const stillExists = levels.some((l) => l.id === currentId);
      if (!stillExists) {
        this.$selectedLevelId.set(levels.length > 0 ? levels[0]!.id : null);
      }
    });
  }

  getLevelEntitiesForChart(chartId: string): Entity[] {
    const em = this.ctx.get(ProjectSlice).entityManager;
    return em
      .entitiesWithComponent(LEVEL)
      .filter((entity) => {
        const ref = em.getComponent(entity, CHART_REF);
        return ref?.chartId === chartId;
      })
      .sort((a, b) => {
        const levelA = em.getComponent(a, LEVEL);
        const levelB = em.getComponent(b, LEVEL);
        return (levelA?.sortOrder ?? 0) - (levelB?.sortOrder ?? 0);
      });
  }

  isLevelHidden(levelId: string): boolean {
    return this.$hiddenLevelIds.get().has(levelId);
  }

  getLevelsForChart(chartId: string): LevelInfo[] {
    return this.getLevelEntitiesForChart(chartId).map((entity) => {
      const level = this.ctx.get(ProjectSlice).entityManager.getComponent(entity, LEVEL);
      return {
        id: entity.id,
        name: level?.name ?? "Untitled",
        mode: level?.mode ?? "beat-7k",
        sortOrder: level?.sortOrder ?? 0,
        visible: !this.isLevelHidden(entity.id),
      };
    });
  }

  getVisibleLevels(chartId: string): LevelInfo[] {
    return this.getLevelsForChart(chartId).filter((l) => l.visible);
  }

  addLevel(chartId: string, name: string, mode: string): string {
    const em = this.ctx.get(ProjectSlice).entityManager;
    const existing = this.getLevelEntitiesForChart(chartId);
    const maxOrder =
      existing.length > 0
        ? Math.max(...existing.map((e) => em.getComponent(e, LEVEL)?.sortOrder ?? 0))
        : -1;
    const level = new EntityBuilder()
      .with(LEVEL, { name, mode, sortOrder: maxOrder + 1 })
      .with(CHART_REF, { chartId })
      .build();
    const previousSelectedLevelId = this.$selectedLevelId.get();
    this.ctx.get(HistorySlice).applyAction(
      new InsertEntityUserAction(
        this.ctx,
        level,
        () => {
          this.$selectedLevelId.set(level.id);
          this.events.emit("levelsChanged");
        },
        () => {
          this.$selectedLevelId.set(previousSelectedLevelId);
          this.events.emit("levelsChanged");
        },
      ),
    );
    return level.id;
  }

  removeLevel(levelId: string): void {
    const chartId = this.ctx.get(ChartSlice).$selectedChartId.get();
    const em = this.ctx.get(ProjectSlice).entityManager;
    const entity = em.get(levelId);
    if (!entity) return;
    const previousHidden = new Set(this.$hiddenLevelIds.get());
    const previousSelectedLevelId = this.$selectedLevelId.get();
    this.ctx.get(HistorySlice).applyAction(
      new DeleteEntityUserAction(
        this.ctx,
        levelId,
        structuredClone(entity),
        () => {
          const hidden = new Set(this.$hiddenLevelIds.get());
          hidden.delete(levelId);
          this.$hiddenLevelIds.set(hidden);
          if (this.$selectedLevelId.get() === levelId && chartId) {
            const remaining = this.getLevelEntitiesForChart(chartId);
            this.$selectedLevelId.set(remaining.length > 0 ? remaining[0]!.id : null);
          }
          this.events.emit("levelsChanged");
        },
        () => {
          this.$hiddenLevelIds.set(previousHidden);
          this.$selectedLevelId.set(previousSelectedLevelId);
          this.events.emit("levelsChanged");
        },
      ),
    );
  }

  toggleLevelVisibility(levelId: string): void {
    const hidden = new Set(this.$hiddenLevelIds.get());
    if (hidden.has(levelId)) {
      hidden.delete(levelId);
    } else {
      hidden.add(levelId);
    }
    this.$hiddenLevelIds.set(hidden);
    this.events.emit("levelsChanged");
  }

  setSelectedLevelId(id: string | null): void {
    this.$selectedLevelId.set(id);
  }

  onLevelsChanged(cb: () => void): () => void {
    return this.events.on("levelsChanged", cb);
  }
}
