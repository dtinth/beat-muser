import { describe, expect, test } from "vite-plus/test";
import { EditorTester, makeProject, entity } from "./tester.ts";
import { EVENT, NOTE, LEVEL_REF, CHART_REF } from "./index.ts";
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

function overlapSpecs(editor: EditorTester) {
  return editor.instance.$visibleRenderObjects.get().filter((s) => s.type === "overlap-indicator");
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
});
