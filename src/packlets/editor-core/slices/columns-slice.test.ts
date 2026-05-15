import { describe, expect, test } from "vite-plus/test";
import type { TimelineColumn } from "../types";
import { buildFlatList, findFlatIndex } from "./column-flat-list";

describe("column-flat-list", () => {
  describe("buildFlatList", () => {
    const gameplayCol: TimelineColumn = {
      id: "level-l1-lane-1",
      title: "1",
      width: 36,
      x: 208,
      levelId: "l1",
      laneIndex: 1,
      affinity: "gameplay",
    };

    const soundCol: TimelineColumn = {
      id: "sound-lane-0",
      title: "Sound 1",
      width: 100,
      x: 380,
      soundLane: 0,
      affinity: "sound",
    };

    test("filters columns by anchor column's gameplay affinity", () => {
      const columns: TimelineColumn[] = [
        { id: "measure", title: "", width: 40, x: 0 },
        { id: "time-sig", title: "Time", width: 48, x: 40 },
        { id: "bpm", title: "BPM", width: 56, x: 88 },
        { id: "spacer-level-1", title: "", width: 8, x: 144 },
        {
          id: "level-l1-lane-8",
          title: "SC",
          width: 56,
          x: 152,
          levelId: "l1",
          laneIndex: 8,
          affinity: "gameplay",
        } as TimelineColumn,
        {
          id: "level-l1-lane-1",
          title: "1",
          width: 36,
          x: 208,
          levelId: "l1",
          laneIndex: 1,
          affinity: "gameplay",
        } as TimelineColumn,
        {
          id: "level-l1-lane-2",
          title: "2",
          width: 28,
          x: 244,
          levelId: "l1",
          laneIndex: 2,
          affinity: "gameplay",
        } as TimelineColumn,
        { id: "spacer-level-2", title: "", width: 8, x: 272 },
        {
          id: "level-l2-lane-8",
          title: "SC",
          width: 56,
          x: 280,
          levelId: "l2",
          laneIndex: 8,
          affinity: "gameplay",
        } as TimelineColumn,
        {
          id: "level-l2-lane-1",
          title: "1",
          width: 36,
          x: 336,
          levelId: "l2",
          laneIndex: 1,
          affinity: "gameplay",
        } as TimelineColumn,
        { id: "spacer-sound", title: "", width: 8, x: 372 },
        {
          id: "sound-lane-0",
          title: "Sound 1",
          width: 100,
          x: 380,
          soundLane: 0,
          affinity: "sound",
        } as TimelineColumn,
        {
          id: "sound-lane-1",
          title: "Sound 2",
          width: 100,
          x: 480,
          soundLane: 1,
          affinity: "sound",
        } as TimelineColumn,
      ];

      const list = buildFlatList(columns, gameplayCol);
      expect(list.map((c) => c.id)).toEqual([
        "level-l1-lane-8",
        "level-l1-lane-1",
        "level-l1-lane-2",
        "level-l2-lane-8",
        "level-l2-lane-1",
      ]);
    });

    test("filters columns by anchor column's sound affinity", () => {
      const columns: TimelineColumn[] = [
        { id: "measure", title: "", width: 40, x: 0 },
        { id: "bpm", title: "BPM", width: 56, x: 40 },
        { id: "spacer-sound", title: "", width: 8, x: 96 },
        {
          id: "sound-lane-0",
          title: "Sound 1",
          width: 100,
          x: 104,
          soundLane: 0,
          affinity: "sound",
        } as TimelineColumn,
        {
          id: "sound-lane-1",
          title: "Sound 2",
          width: 100,
          x: 204,
          soundLane: 1,
          affinity: "sound",
        } as TimelineColumn,
        {
          id: "sound-lane-2",
          title: "Sound 3",
          width: 100,
          x: 304,
          soundLane: 2,
          affinity: "sound",
        } as TimelineColumn,
      ];

      const list = buildFlatList(columns, soundCol);
      expect(list.map((c) => c.id)).toEqual(["sound-lane-0", "sound-lane-1", "sound-lane-2"]);
    });

    test("returns empty array when anchor has no affinity", () => {
      const columns: TimelineColumn[] = [
        { id: "measure", title: "", width: 40, x: 0 },
        { id: "bpm", title: "BPM", width: 56, x: 40 },
      ];
      const anchor: TimelineColumn = { id: "bpm", title: "BPM", width: 56, x: 40 };
      expect(buildFlatList(columns, anchor)).toEqual([]);
    });

    test("returns empty array when no columns match affinity", () => {
      const columns: TimelineColumn[] = [{ id: "measure", title: "", width: 40, x: 0 }];
      expect(buildFlatList(columns, gameplayCol)).toEqual([]);
    });
  });

  describe("findFlatIndex", () => {
    const flatList: TimelineColumn[] = [
      { id: "col-a", title: "A", width: 100, x: 0 },
      { id: "col-b", title: "B", width: 100, x: 100 },
      { id: "col-c", title: "C", width: 100, x: 200 },
    ];

    test("finds index of matching column id", () => {
      expect(findFlatIndex(flatList, "col-a")).toBe(0);
      expect(findFlatIndex(flatList, "col-b")).toBe(1);
      expect(findFlatIndex(flatList, "col-c")).toBe(2);
    });

    test("returns undefined for unknown column id", () => {
      expect(findFlatIndex(flatList, "col-z")).toBeUndefined();
    });

    test("returns undefined for empty list", () => {
      expect(findFlatIndex([], "col-a")).toBeUndefined();
    });
  });
});
