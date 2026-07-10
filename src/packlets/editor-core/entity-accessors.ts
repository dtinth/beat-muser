import type { Entity } from "../entity-manager/index.ts";
import { EVENT, NOTE, LEVEL_REF, SOUND_EVENT } from "./components.ts";

export function getPulse(entity: Entity): number | undefined {
  return (entity.components as Record<string, { y: number } | undefined>)[EVENT.key]?.y;
}

export function getNoteColumn(entity: Entity): { levelId: string; laneIndex: number } | null {
  const note = (entity.components as Record<string, { lane: number } | undefined>)[NOTE.key];
  const levelRef = (entity.components as Record<string, { levelId: string } | undefined>)[
    LEVEL_REF.key
  ];
  return note && levelRef ? { levelId: levelRef.levelId, laneIndex: note.lane } : null;
}

export function getSoundLane(entity: Entity): number | null {
  return (
    (entity.components as Record<string, { soundLane: number } | undefined>)[SOUND_EVENT.key]
      ?.soundLane ?? null
  );
}
