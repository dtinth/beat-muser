import { describe, expect, test } from "vite-plus/test";
import { EditorTester, makeProject, entity } from "./tester.ts";
import { EVENT, NOTE, BPM_CHANGE, LEVEL_REF, CHART_REF } from "./index.ts";
import type { Entity } from "../entity-manager/index.ts";

function noteAt(chartId: string, levelId: string, y: number, lane: number): Entity {
  return entity((e) =>
    e
      .with(EVENT, { y })
      .with(NOTE, { lane })
      .with(LEVEL_REF, { levelId })
      .with(CHART_REF, { chartId }),
  );
}

function bpmAt(chartId: string, y: number, bpm: number): Entity {
  return entity((e) => e.with(EVENT, { y }).with(BPM_CHANGE, { bpm }).with(CHART_REF, { chartId }));
}

function overlapSpecs(editor: EditorTester) {
  return editor.instance.getVisibleRenderObjects().filter((s) => s.type === "overlap-indicator");
}

describe("overlap indicator", () => {
  test("two notes in the same level/lane/pulse produce one overlap indicator", () => {
    const editor = new EditorTester({
      getProjectToLoad: () =>
        makeProject((p) => {
          const chart = p.addChart("Hard", undefined, 15360);
          const level = p.addLevel(chart.id, "Easy", "beat-7k");
          p.add(noteAt(chart.id, level.id, 480, 1));
          p.add(noteAt(chart.id, level.id, 480, 1));
        }),
    });
    expect(overlapSpecs(editor)).toHaveLength(1);
  });

  test("a single note produces no overlap indicator", () => {
    const editor = new EditorTester({
      getProjectToLoad: () =>
        makeProject((p) => {
          const chart = p.addChart("Hard", undefined, 15360);
          const level = p.addLevel(chart.id, "Easy", "beat-7k");
          p.add(noteAt(chart.id, level.id, 480, 1));
        }),
    });
    expect(overlapSpecs(editor)).toHaveLength(0);
  });

  test("notes on different lanes at the same pulse do not overlap", () => {
    const editor = new EditorTester({
      getProjectToLoad: () =>
        makeProject((p) => {
          const chart = p.addChart("Hard", undefined, 15360);
          const level = p.addLevel(chart.id, "Easy", "beat-7k");
          p.add(noteAt(chart.id, level.id, 480, 1));
          p.add(noteAt(chart.id, level.id, 480, 2));
        }),
    });
    expect(overlapSpecs(editor)).toHaveLength(0);
  });

  test("notes on the same lane at different pulses do not overlap", () => {
    const editor = new EditorTester({
      getProjectToLoad: () =>
        makeProject((p) => {
          const chart = p.addChart("Hard", undefined, 15360);
          const level = p.addLevel(chart.id, "Easy", "beat-7k");
          p.add(noteAt(chart.id, level.id, 480, 1));
          p.add(noteAt(chart.id, level.id, 720, 1));
        }),
    });
    expect(overlapSpecs(editor)).toHaveLength(0);
  });

  test("three stacked notes produce one indicator carrying the count", () => {
    const editor = new EditorTester({
      getProjectToLoad: () =>
        makeProject((p) => {
          const chart = p.addChart("Hard", undefined, 15360);
          const level = p.addLevel(chart.id, "Easy", "beat-7k");
          p.add(noteAt(chart.id, level.id, 480, 1));
          p.add(noteAt(chart.id, level.id, 480, 1));
          p.add(noteAt(chart.id, level.id, 480, 1));
        }),
    });
    const overlaps = overlapSpecs(editor);
    expect(overlaps).toHaveLength(1);
    expect(overlaps[0].data.count).toBe(3);
  });

  test("the same note placed on two levels does not overlap (different columns)", () => {
    const editor = new EditorTester({
      getProjectToLoad: () =>
        makeProject((p) => {
          const chart = p.addChart("Hard", undefined, 15360);
          const easy = p.addLevel(chart.id, "Easy", "beat-7k", 0);
          const hard = p.addLevel(chart.id, "Hard", "beat-7k", 1);
          p.add(noteAt(chart.id, easy.id, 480, 1));
          p.add(noteAt(chart.id, hard.id, 480, 1));
        }),
    });
    expect(overlapSpecs(editor)).toHaveLength(0);
  });

  test("two BPM changes at the same pulse produce an overlap indicator", () => {
    const editor = new EditorTester({
      getProjectToLoad: () =>
        makeProject((p) => {
          const chart = p.addChart("Hard", undefined, 15360);
          p.addLevel(chart.id, "Easy", "beat-7k");
          p.add(bpmAt(chart.id, 480, 120));
          p.add(bpmAt(chart.id, 480, 140));
        }),
    });
    expect(overlapSpecs(editor)).toHaveLength(1);
  });
});
