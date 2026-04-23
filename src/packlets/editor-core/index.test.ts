/**
 * @packageDocumentation
 *
 * Unit tests for EditorController.
 *
 * Uses a tester helper class to keep tests focused on behavior, not
 * implementation details.
 */

import { describe, expect, test } from "vite-plus/test";
import { EditorController } from "./index";
import type { ProjectFile, Entity } from "../project-format";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeProject(entities: Entity[] = []): ProjectFile {
  return {
    schemaVersion: 2,
    version: "test-version",
    metadata: { title: "Test", artist: "Test", genre: "Test" },
    entities,
    deletedEntities: [],
  };
}

function makeChart(name: string, size = 15360): Entity {
  return {
    id: `chart-${name}`,
    version: "v1",
    components: { chart: { name, mode: "4k", size } },
  };
}

class EditorControllerTester {
  readonly controller: EditorController;

  constructor(controller: EditorController) {
    this.controller = controller;
  }

  shouldHaveSelectedChart(expected: { name: string; mode: string; size: number }) {
    const chart = this.controller.getSelectedChart();
    expect(chart).toBeDefined();
    expect(chart!.components.chart).toMatchObject(expected);
  }

  shouldHaveChartSize(expected: number) {
    expect(this.controller.getChartSize()).toBe(expected);
  }

  shouldHaveEntityCount(expected: number) {
    expect(this.controller.$entities.get().size).toBe(expected);
  }

  shouldHaveTimingEngine() {
    const engine = this.controller.getTimingEngine();
    expect(engine).toBeDefined();
    expect(typeof engine.getMeasureBoundaries).toBe("function");
    expect(typeof engine.getSnapPoints).toBe("function");
  }

  measureBoundariesInRange(start: number, end: number): number[] {
    return this.controller.getTimingEngine().getMeasureBoundaries({ start, end });
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("EditorController", () => {
  test("creates a default chart when project has no charts", () => {
    const t = new EditorControllerTester(new EditorController({ project: makeProject() }));

    t.shouldHaveSelectedChart({ name: "Untitled", mode: "4k", size: 15360 });
  });

  test("selects the first existing chart when project has charts", () => {
    const t = new EditorControllerTester(
      new EditorController({
        project: makeProject([makeChart("Hard", 24000), makeChart("Easy", 12000)]),
      }),
    );

    t.shouldHaveSelectedChart({ name: "Hard", mode: "4k", size: 24000 });
  });

  test("reports the selected chart's size", () => {
    const t = new EditorControllerTester(
      new EditorController({
        project: makeProject([makeChart("Custom", 9999)]),
      }),
    );

    t.shouldHaveChartSize(9999);
  });

  test("falls back to default size when chart component lacks size field", () => {
    const chart: Entity = {
      id: "chart-no-size",
      version: "v1",
      components: { chart: { name: "Test", mode: "4k" } },
    };
    const t = new EditorControllerTester(new EditorController({ project: makeProject([chart]) }));

    t.shouldHaveChartSize(15360);
  });

  test("provides a default timing engine (60 BPM, 4/4)", () => {
    const t = new EditorControllerTester(new EditorController({ project: makeProject() }));

    t.shouldHaveTimingEngine();

    // Default 4/4 measure length at 240 PPQN = 960 pulses.
    const boundaries = t.measureBoundariesInRange(0, 2000);
    expect(boundaries).toEqual([0, 960, 1920]);
  });

  test("ingests all project entities", () => {
    const note: Entity = {
      id: "note-1",
      version: "v1",
      components: { event: { y: 240 }, note: { lane: 0 } },
    };
    const t = new EditorControllerTester(
      new EditorController({
        project: makeProject([makeChart("Hard"), note]),
      }),
    );

    t.shouldHaveEntityCount(2);
  });
});
