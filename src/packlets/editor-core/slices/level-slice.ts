import { atom } from "nanostores";
import { createNanoEvents } from "nanoevents";
import { uuidv7 } from "uuidv7";
import { Slice } from "../slice";
import { ProjectSlice } from "./project-slice";
import { CHART_REF, LEVEL } from "../components";
import type { Entity } from "../../entity-manager";
import type { LevelInfo } from "../types";

export class LevelSlice extends Slice {
  static readonly sliceKey = "level";

  $hiddenLevelIds = atom<Set<string>>(new Set());
  private events = createNanoEvents<{ levelsChanged: () => void }>();

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
    const id = uuidv7();
    const level: Entity = {
      id,
      version: uuidv7(),
      components: {
        level: { name, mode, sortOrder: maxOrder + 1 },
        chartRef: { chartId },
      },
    };
    em.insert(level);
    this.events.emit("levelsChanged");
    return id;
  }

  removeLevel(levelId: string): void {
    this.ctx.get(ProjectSlice).entityManager.remove(levelId);
    const hidden = new Set(this.$hiddenLevelIds.get());
    hidden.delete(levelId);
    this.$hiddenLevelIds.set(hidden);
    this.events.emit("levelsChanged");
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

  onLevelsChanged(cb: () => void): () => void {
    return this.events.on("levelsChanged", cb);
  }
}
