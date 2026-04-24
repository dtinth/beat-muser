/**
 * @packageDocumentation
 *
 * Unit tests for EditorController.
 *
 * Uses a tester helper class to keep tests focused on behavior, not
 * implementation details.
 */

import { describe, expect, test } from "vite-plus/test";
import { EditorController, CHART } from "./index";
import type { ProjectFile } from "../project-format";
import type { Entity } from "../entity-manager";

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

function makeBpmChange(y: number, bpm: number): Entity {
  return {
    id: `bpm-${y}-${bpm}`,
    version: "v1",
    components: {
      event: { y },
      bpmChange: { bpm },
    },
  };
}

function makeTimeSignature(y: number, numerator: number, denominator: number): Entity {
  return {
    id: `ts-${y}-${numerator}-${denominator}`,
    version: "v1",
    components: {
      event: { y },
      timeSignature: { numerator, denominator },
    },
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
    expect(this.controller.getEntityManager().getComponent(chart!, CHART)).toMatchObject(expected);
  }

  shouldHaveChartSize(expected: number) {
    expect(this.controller.getChartSize()).toBe(expected);
  }

  shouldHaveEntityCount(expected: number) {
    expect(this.controller.getEntityManager().toArray().length).toBe(expected);
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

  shouldHaveColumnCount(expected: number) {
    expect(this.controller.getColumns().length).toBe(expected);
  }

  shouldHaveTimelineWidth(expected: number) {
    expect(this.controller.getTimelineWidth()).toBe(expected);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("EditorController", () => {
  test("creates a default chart when project has no charts", () => {
    const t = new EditorControllerTester(new EditorController({ project: makeProject() }));

    t.shouldHaveSelectedChart({ name: "Untitled", mode: "beat-7k", size: 15360 });
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

  test("provides default columns", () => {
    const t = new EditorControllerTester(new EditorController({ project: makeProject() }));

    t.shouldHaveColumnCount(3);
    t.shouldHaveTimelineWidth(40 + 48 + 56 + 1);
  });

  test("columns have cumulative x positions", () => {
    const controller = new EditorController({ project: makeProject() });
    const columns = controller.getColumns();

    expect(columns[0]).toMatchObject({ id: "measure", x: 0, width: 40 });
    expect(columns[1]).toMatchObject({ id: "time-sig", x: 40, width: 48 });
    expect(columns[2]).toMatchObject({ id: "bpm", x: 88, width: 56 });
  });

  test("extracts BPM changes from entities", () => {
    const controller = new EditorController({
      project: makeProject([makeChart("Hard"), makeBpmChange(0, 120), makeBpmChange(960, 180)]),
    });

    const engine = controller.getTimingEngine();
    const secondsAt960 = engine.pulseToSeconds(960);
    // At 120 BPM, 960 pulses = 4 beats = 2 seconds.
    expect(secondsAt960).toBeCloseTo(2, 5);

    const secondsAt1920 = engine.pulseToSeconds(1920);
    // At 180 BPM, next 960 pulses = 4 beats = 1.333... seconds.
    // Total = 2 + 1.333... = 3.333...
    expect(secondsAt1920).toBeCloseTo(3.333333, 5);
  });

  test("extracts time signatures from entities", () => {
    const controller = new EditorController({
      project: makeProject([makeChart("Hard"), makeTimeSignature(0, 3, 4)]),
    });

    const engine = controller.getTimingEngine();
    const boundaries = engine.getMeasureBoundaries({ start: 0, end: 2500 });
    // 3/4 at 240 PPQN = 3 * 240 = 720 pulses per measure.
    expect(boundaries).toEqual([0, 720, 1440, 2160]);
  });

  test("combines BPM changes and time signatures", () => {
    const controller = new EditorController({
      project: makeProject([
        makeChart("Hard"),
        makeBpmChange(0, 120),
        makeTimeSignature(0, 3, 4),
        makeTimeSignature(1440, 4, 4),
      ]),
    });

    const engine = controller.getTimingEngine();
    const boundaries = engine.getMeasureBoundaries({ start: 0, end: 3000 });
    // 3/4 = 720 per measure, then 4/4 = 960 per measure after pulse 1440.
    expect(boundaries).toEqual([0, 720, 1440, 2400]);
  });
});
