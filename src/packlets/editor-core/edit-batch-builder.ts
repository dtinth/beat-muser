import { type EntityManager } from "../entity-manager/index.ts";
import { EVENT, NOTE, LEVEL_REF, SOUND_EVENT, KEYSOUND } from "./components.ts";
import { BatchEditEntitiesUserAction } from "./user-actions.ts";
import type { EditorContext } from "./editor-context.ts";

export interface EditEntry {
  entityId: string;
  oldComponents: Record<string, unknown>;
  newComponents: Record<string, unknown>;
}

export class EditBatchBuilder {
  private editMap = new Map<string, EditEntry>();
  private em: EntityManager;

  constructor(em: EntityManager) {
    this.em = em;
  }

  private getOrCreateEdit(entityId: string): EditEntry {
    let entry = this.editMap.get(entityId);
    if (!entry) {
      const entity = this.em.get(entityId);
      if (!entity) throw new Error(`Entity ${entityId} not found`);
      entry = {
        entityId,
        oldComponents: structuredClone(entity.components),
        newComponents: structuredClone(entity.components),
      };
      this.editMap.set(entityId, entry);
    }
    return entry;
  }

  setPulse(entityId: string, pulse: number): this {
    const entry = this.getOrCreateEdit(entityId);
    (entry.newComponents as Record<string, any> as Record<string, { y: number }>)[EVENT.key].y =
      pulse;
    return this;
  }

  setNoteColumn(entityId: string, levelId: string, laneIndex: number): this {
    const entry = this.getOrCreateEdit(entityId);
    (entry.newComponents as Record<string, any> as Record<string, { lane: number }>)[
      NOTE.key
    ].lane = laneIndex;
    (entry.newComponents as Record<string, any> as Record<string, { levelId: string }>)[
      LEVEL_REF.key
    ].levelId = levelId;
    return this;
  }

  setSoundLane(entityId: string, soundLane: number): this {
    const entry = this.getOrCreateEdit(entityId);
    (entry.newComponents as Record<string, any> as Record<string, { soundLane: number }>)[
      SOUND_EVENT.key
    ].soundLane = soundLane;
    return this;
  }

  setKeysoundLane(entityId: string, soundLane: number): this {
    const entry = this.getOrCreateEdit(entityId);
    (entry.newComponents as Record<string, any> as Record<string, { soundLane: number }>)[
      KEYSOUND.key
    ].soundLane = soundLane;
    return this;
  }

  getModifiedEntityIds(): Set<string> {
    return new Set(this.editMap.keys());
  }

  build(): EditEntry[] {
    return [...this.editMap.values()];
  }

  toUserAction(ctx: EditorContext): BatchEditEntitiesUserAction {
    return new BatchEditEntitiesUserAction(ctx, this.build());
  }
}
