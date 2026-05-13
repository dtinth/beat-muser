import { describe, expect, test } from "vite-plus/test";
import type { TimelineColumn } from "../types";
import {
  computeGameplayFlatList,
  computeSoundFlatList,
  findGameplayFlatIndex,
  findSoundFlatIndex,
  type GameplayFlatEntry,
  type SoundFlatEntry,
} from "./column-flat-list";

describe("column-flat-list", () => {
  describe("computeGameplayFlatList", () => {
    test("extracts gameplay columns only (excludes spacers and timing)", () => {
      const columns: TimelineColumn[] = [
        { id: "measure", title: "", width: 40, x: 0 },
        { id: "time-sig", title: "Time", width: 48, x: 40 },
        { id: "bpm", title: "BPM", width: 56, x: 88 },
        { id: "spacer-level-1", title: "", width: 8, x: 144 },
        { id: "level-1-lane-8", title: "SC", width: 56, x: 152, levelId: "l1", laneIndex: 8 },
        { id: "level-1-lane-1", title: "1", width: 36, x: 208, levelId: "l1", laneIndex: 1 },
        { id: "level-1-lane-2", title: "2", width: 28, x: 244, levelId: "l1", laneIndex: 2 },
        { id: "spacer-level-2", title: "", width: 8, x: 272 },
        { id: "level-2-lane-8", title: "SC", width: 56, x: 280, levelId: "l2", laneIndex: 8 },
        { id: "level-2-lane-1", title: "1", width: 36, x: 336, levelId: "l2", laneIndex: 1 },
        { id: "spacer-sound", title: "", width: 8, x: 372 },
        { id: "sound-lane-0", title: "Sound 1", width: 100, x: 380, soundLane: 0 },
        { id: "sound-lane-1", title: "Sound 2", width: 100, x: 480, soundLane: 1 },
      ];

      const list = computeGameplayFlatList(columns);
      expect(list).toEqual([
        { type: "gameplay", levelId: "l1", laneIndex: 8, columnIndex: 4 },
        { type: "gameplay", levelId: "l1", laneIndex: 1, columnIndex: 5 },
        { type: "gameplay", levelId: "l1", laneIndex: 2, columnIndex: 6 },
        { type: "gameplay", levelId: "l2", laneIndex: 8, columnIndex: 8 },
        { type: "gameplay", levelId: "l2", laneIndex: 1, columnIndex: 9 },
      ]);
    });

    test("returns empty array when no gameplay columns", () => {
      const columns: TimelineColumn[] = [
        { id: "measure", title: "", width: 40, x: 0 },
        { id: "bpm", title: "BPM", width: 56, x: 40 },
      ];
      expect(computeGameplayFlatList(columns)).toEqual([]);
    });
  });

  describe("computeSoundFlatList", () => {
    test("extracts sound columns only", () => {
      const columns: TimelineColumn[] = [
        { id: "measure", title: "", width: 40, x: 0 },
        { id: "bpm", title: "BPM", width: 56, x: 40 },
        { id: "spacer-sound", title: "", width: 8, x: 96 },
        { id: "sound-lane-0", title: "Sound 1", width: 100, x: 104, soundLane: 0 },
        { id: "sound-lane-1", title: "Sound 2", width: 100, x: 204, soundLane: 1 },
        { id: "sound-lane-2", title: "Sound 3", width: 100, x: 304, soundLane: 2 },
      ];

      const list = computeSoundFlatList(columns);
      expect(list).toEqual([
        { type: "sound", soundLane: 0, columnIndex: 3 },
        { type: "sound", soundLane: 1, columnIndex: 4 },
        { type: "sound", soundLane: 2, columnIndex: 5 },
      ]);
    });

    test("returns empty array when no sound columns", () => {
      const columns: TimelineColumn[] = [{ id: "measure", title: "", width: 40, x: 0 }];
      expect(computeSoundFlatList(columns)).toEqual([]);
    });
  });

  describe("finding index in flat list", () => {
    test("findGameplayFlatIndex finds matching entry", () => {
      const list: GameplayFlatEntry[] = [
        { type: "gameplay", levelId: "l1", laneIndex: 8, columnIndex: 0 },
        { type: "gameplay", levelId: "l1", laneIndex: 1, columnIndex: 1 },
        { type: "gameplay", levelId: "l1", laneIndex: 2, columnIndex: 2 },
        { type: "gameplay", levelId: "l2", laneIndex: 8, columnIndex: 3 },
        { type: "gameplay", levelId: "l2", laneIndex: 1, columnIndex: 4 },
      ];

      expect(findGameplayFlatIndex(list, "l1", 2)).toBe(2);
      expect(findGameplayFlatIndex(list, "l2", 8)).toBe(3);
      expect(findGameplayFlatIndex(list, "l1", 99)).toBeUndefined();
      expect(findGameplayFlatIndex(list, "unknown", 1)).toBeUndefined();
    });

    test("findSoundFlatIndex finds matching entry", () => {
      const list: SoundFlatEntry[] = [
        { type: "sound", soundLane: 0, columnIndex: 0 },
        { type: "sound", soundLane: 1, columnIndex: 1 },
        { type: "sound", soundLane: 2, columnIndex: 2 },
      ];

      expect(findSoundFlatIndex(list, 1)).toBe(1);
      expect(findSoundFlatIndex(list, 2)).toBe(2);
      expect(findSoundFlatIndex(list, 99)).toBeUndefined();
    });
  });
});
