import { type EntityManager } from "../entity-manager";
import { EVENT, NOTE, LEVEL_REF, SOUND_EVENT, KEYSOUND } from "./components";
import { BatchEditEntitiesUserAction } from "./user-actions";
import type { EditorContext } from "./editor-context";

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
    (entry.newComponents[EVENT.key] as { y: number }).y = pulse;
    return this;
  }

  setNoteColumn(entityId: string, levelId: string, laneIndex: number): this {
    const entry = this.getOrCreateEdit(entityId);
    (entry.newComponents[NOTE.key] as { lane: number }).lane = laneIndex;
    (entry.newComponents[LEVEL_REF.key] as { levelId: string }).levelId = levelId;
    return this;
  }

  setSoundLane(entityId: string, soundLane: number): this {
    const entry = this.getOrCreateEdit(entityId);
    (entry.newComponents[SOUND_EVENT.key] as { soundLane: number }).soundLane = soundLane;
    return this;
  }

  setKeysoundLane(entityId: string, soundLane: number): this {
    const entry = this.getOrCreateEdit(entityId);
    (entry.newComponents[KEYSOUND.key] as { soundLane: number }).soundLane = soundLane;
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
