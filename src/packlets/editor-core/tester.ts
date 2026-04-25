/**
 * @packageDocumentation
 *
 * Acceptance-test helper for the editor core. Simulates user-level
 * interactions (hover, zoom, scroll) and provides readable assertions
 * against the EditorController state.
 */

import { expect } from "vite-plus/test";
import { EditorController, CHART } from "./index";
import type { ProjectFile } from "../project-format";
import { EntityComponentType, type Entity } from "../entity-manager";
import { createDemoProjectFile } from "../project-store";
import type { Static, TSchema } from "typebox";
import { EVENT, BPM_CHANGE, TIME_SIGNATURE, CHART_REF, NOTE, LEVEL_REF, LEVEL } from "./components";
import { Rect, type Point as PointType } from "../geometry";

export class EntityBuilder {
  private components: Record<string, unknown> = {};

  with<T extends TSchema>(component: EntityComponentType<T>, data: Static<T>): this {
    this.components[component.key] = data;
    return this;
  }

  build(): Entity {
    return {
      id: crypto.randomUUID(),
      version: crypto.randomUUID(),
      components: { ...this.components },
    };
  }
}

export function entity(callback: (e: EntityBuilder) => void): Entity {
  const builder = new EntityBuilder();
  callback(builder);
  return builder.build();
}

export class ChartBuilder {
  private chartId: string;
  private projectBuilder: ProjectBuilder;

  constructor(chartId: string, projectBuilder: ProjectBuilder) {
    this.chartId = chartId;
    this.projectBuilder = projectBuilder;
  }

  private addWithChartRef(build: (e: EntityBuilder) => void): Entity {
    const ent = entity((e) => {
      build(e);
      e.with(CHART_REF, { chartId: this.chartId });
    });
    this.projectBuilder.add(ent);
    return ent;
  }

  addEntity(callback: (e: EntityBuilder) => void): Entity {
    return this.addWithChartRef(callback);
  }

  bpmChange(y: number, bpm: number): Entity {
    return this.addWithChartRef((e) => e.with(EVENT, { y }).with(BPM_CHANGE, { bpm }));
  }

  timeSignature(y: number, numerator: number, denominator: number): Entity {
    return this.addWithChartRef((e) =>
      e.with(EVENT, { y }).with(TIME_SIGNATURE, { numerator, denominator }),
    );
  }

  note(y: number, lane: number, levelId: string): Entity {
    return this.addWithChartRef((e) =>
      e.with(EVENT, { y }).with(NOTE, { lane }).with(LEVEL_REF, { levelId }),
    );
  }
}

export class ProjectBuilder {
  private entities: Entity[] = [];

  add(entity: Entity): Entity {
    this.entities.push(entity);
    return entity;
  }

  addEntity(callback: (e: EntityBuilder) => void): Entity {
    const ent = entity(callback);
    this.add(ent);
    return ent;
  }

  addChart(name: string, callback?: (c: ChartBuilder) => void, size?: number): Entity {
    const chart = entity((e) => e.with(CHART, { name, size }));
    this.add(chart);
    if (callback) {
      callback(new ChartBuilder(chart.id, this));
    }
    return chart;
  }

  addLevel(chartId: string, name: string, mode: string, sortOrder?: number): Entity {
    const level = entity((e) =>
      e.with(LEVEL, { name, mode, sortOrder: sortOrder ?? 0 }).with(CHART_REF, { chartId }),
    );
    this.add(level);
    return level;
  }

  build(): ProjectFile {
    return {
      schemaVersion: 2,
      version: "test-version",
      metadata: { title: "Test", artist: "Test", genre: "Test" },
      entities: this.entities,
      deletedEntities: [],
    };
  }
}

export function makeProject(
  entitiesOrCallback: Entity[] | ((p: ProjectBuilder) => void) = [],
): ProjectFile {
  if (Array.isArray(entitiesOrCallback)) {
    return {
      schemaVersion: 2,
      version: "test-version",
      metadata: { title: "Test", artist: "Test", genre: "Test" },
      entities: entitiesOrCallback,
      deletedEntities: [],
    };
  }
  const builder = new ProjectBuilder();
  entitiesOrCallback(builder);
  return builder.build();
}

export class EditorTester {
  readonly instance: EditorController;

  constructor(options?: {
    getProjectToLoad?: () => ProjectFile;
    viewport?: { width: number; height: number };
  }) {
    const project = options?.getProjectToLoad?.() ?? createDemoProjectFile();
    this.instance = new EditorController({ project });

    const viewportWidth = options?.viewport?.width ?? 640;
    const viewportHeight = options?.viewport?.height ?? 480;
    this.instance.setViewportSize(viewportWidth, viewportHeight);

    // Subscribe to outbox so scroll notifications (e.g. from onConnected or
    // setZoom) are applied, closing the loop just like the real DOM does.
    this.instance.outbox.on("setScrollTop", (top) => {
      this.instance.setScrollTop(top);
    });
    this.instance.onConnected();
  }

  pointerMove({ x, y }: { x?: number; y: number }) {
    this.instance.setCursor(x ?? 0, y);
  }

  pointerDown(point: PointType, options?: { shiftKey?: boolean }) {
    this.instance.handlePointerDown(point, options?.shiftKey ?? false);
  }

  eventRect(entityId: string): Rect {
    const specs = this.instance.$visibleRenderObjects.get();
    const spec = specs.find((s) => s.key.endsWith(`-${entityId}`));
    expect(spec).toBeDefined();
    return { x: spec!.x, y: spec!.y, width: spec!.width, height: spec!.height };
  }

  zoom(value: number) {
    this.instance.setZoom(value);
  }

  scrollTo(y: number) {
    this.instance.setScrollTop(y);
  }

  get scrollHeight() {
    return this.instance.getContentHeight();
  }

  get scrollTop() {
    return this.instance.$scrollTop.get();
  }

  selection = {
    shouldContain: (id: string) => {
      expect(this.instance.$selection.get().has(id)).toBe(true);
    },
    shouldBeEmpty: () => {
      expect(this.instance.$selection.get().size).toBe(0);
    },
  };

  playhead = {
    shouldBeAtPulse: (expected: number) => {
      expect(this.instance.$cursorPulse.get()).toBe(expected);
    },
    shouldBeAtTime: (expected: string) => {
      const engine = this.instance.getTimingEngine();
      const seconds = engine.pulseToSeconds(this.instance.$cursorPulse.get());
      expect(engine.formatTime(seconds)).toBe(expected);
    },
    shouldHavePositionRelativeToViewport: (expectedY: number) => {
      const specs = this.instance.$visibleRenderObjects.get();
      const playhead = specs.find((s) => s.type === "playhead");
      expect(playhead).toBeDefined();
      const playheadViewportY = playhead!.y - this.instance.$scrollTop.get();
      expect(playheadViewportY).toBe(expectedY);
    },
  };

  chart = {
    shouldHaveName: (expected: string) => {
      const chart = this.instance.getSelectedChart();
      expect(chart).toBeDefined();
      const component = this.instance.getEntityManager().getComponent(chart!, CHART);
      expect(component?.name).toBe(expected);
    },
    shouldHaveSize: (expected: number) => {
      expect(this.instance.getChartSize()).toBe(expected);
    },
  };

  timing = {
    shouldHaveMeasureBoundaries: (range: { start: number; end: number }, expected: number[]) => {
      const engine = this.instance.getTimingEngine();
      const boundaries = engine.getMeasureBoundaries(range);
      expect(boundaries).toEqual(expected);
    },
    atPulse: (pulse: number) => ({
      shouldBeAtTime: (expected: string) => {
        const engine = this.instance.getTimingEngine();
        const seconds = engine.pulseToSeconds(pulse);
        expect(engine.formatTime(seconds)).toBe(expected);
      },
    }),
  };

  columns = {
    shouldHaveCount: (expected: number) => {
      expect(this.instance.getColumns().length).toBe(expected);
    },
    shouldHaveTotalWidth: (expected: number) => {
      expect(this.instance.getTimelineWidth()).toBe(expected);
    },
    at: (index: number) => ({
      shouldMatch: (expected: Partial<{ id: string; x: number; width: number }>) => {
        const col = this.instance.getColumns()[index];
        expect(col).toBeDefined();
        expect(col).toMatchObject(expected);
      },
    }),
  };
}
