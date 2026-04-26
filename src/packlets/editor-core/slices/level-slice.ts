import { atom } from "nanostores";
import { Slice } from "../slice";
import { ProjectSlice } from "./project-slice";
import { CHART_REF, LEVEL } from "../components";
import type { Entity } from "../../entity-manager";

export class LevelSlice extends Slice {
  static readonly sliceKey = "level";

  $hiddenLevelIds = atom<Set<string>>(new Set());

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

  addLevel(chartId: string, name: string, mode: string): string {
    const em = this.ctx.get(ProjectSlice).entityManager;
    const existing = this.getLevelEntitiesForChart(chartId);
    const maxOrder =
      existing.length > 0
        ? Math.max(...existing.map((e) => em.getComponent(e, LEVEL)?.sortOrder ?? 0))
        : -1;
    const id = `level-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const level: Entity = {
      id,
      version: id,
      components: {
        level: { name, mode, sortOrder: maxOrder + 1 },
        chartRef: { chartId },
      },
    };
    em.insert(level);
    return id;
  }

  removeLevel(levelId: string): void {
    this.ctx.get(ProjectSlice).entityManager.remove(levelId);
    const hidden = new Set(this.$hiddenLevelIds.get());
    hidden.delete(levelId);
    this.$hiddenLevelIds.set(hidden);
  }

  toggleLevelVisibility(levelId: string): void {
    const hidden = new Set(this.$hiddenLevelIds.get());
    if (hidden.has(levelId)) {
      hidden.delete(levelId);
    } else {
      hidden.add(levelId);
    }
    this.$hiddenLevelIds.set(hidden);
  }
}
