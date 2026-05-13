import type { TimelineColumn } from "../types";

export interface GameplayFlatEntry {
  type: "gameplay";
  levelId: string;
  laneIndex: number;
  columnIndex: number;
}

export interface SoundFlatEntry {
  type: "sound";
  soundLane: number;
  columnIndex: number;
}

export type FlatListEntry = GameplayFlatEntry | SoundFlatEntry;

export function computeGameplayFlatList(columns: TimelineColumn[]): GameplayFlatEntry[] {
  const result: GameplayFlatEntry[] = [];
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i]!;
    if (col.levelId !== undefined && col.laneIndex !== undefined) {
      result.push({
        type: "gameplay",
        levelId: col.levelId,
        laneIndex: col.laneIndex,
        columnIndex: i,
      });
    }
  }
  return result;
}

export function computeSoundFlatList(columns: TimelineColumn[]): SoundFlatEntry[] {
  const result: SoundFlatEntry[] = [];
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i]!;
    if (col.soundLane !== undefined) {
      result.push({ type: "sound", soundLane: col.soundLane, columnIndex: i });
    }
  }
  return result;
}

export function findGameplayFlatIndex(
  list: GameplayFlatEntry[],
  levelId: string,
  laneIndex: number,
): number | undefined {
  const idx = list.findIndex((e) => e.levelId === levelId && e.laneIndex === laneIndex);
  return idx >= 0 ? idx : undefined;
}

export function findSoundFlatIndex(list: SoundFlatEntry[], soundLane: number): number | undefined {
  const idx = list.findIndex((e) => e.soundLane === soundLane);
  return idx >= 0 ? idx : undefined;
}
