import type { Entity } from "../entity-manager/index.ts";
import { EVENT, NOTE, LEVEL_REF, SOUND_EVENT } from "./components.ts";

export function getPulse(entity: Entity): number | undefined {
  return (entity.components[EVENT.key] as { y: number } | undefined)?.y;
}

export function getNoteColumn(entity: Entity): { levelId: string; laneIndex: number } | null {
  const note = entity.components[NOTE.key] as { lane: number } | undefined;
  const levelRef = entity.components[LEVEL_REF.key] as { levelId: string } | undefined;
  return note && levelRef ? { levelId: levelRef.levelId, laneIndex: note.lane } : null;
}

export function getSoundLane(entity: Entity): number | null {
  return (
    (entity.components[SOUND_EVENT.key] as { soundLane: number } | undefined)?.soundLane ?? null
  );
}
