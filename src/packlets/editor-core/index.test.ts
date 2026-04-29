/**
 * @packageDocumentation
 *
 * Acceptance tests for the editor core, expressed as user-level interactions
 * against an `EditorTester` that simulates the timeline behavior layer.
 */

import { describe, expect, test } from "vite-plus/test";
import { EditorTester, makeProject, entity } from "./tester";
import {
  CHART,
  NOTE,
  BPM_CHANGE,
  TIME_SIGNATURE,
  EVENT,
  CHART_REF,
  LEVEL_REF,
  ChartSlice,
  SelectionSlice,
  ViewportSlice,
  ColumnsSlice,
} from "./index";
import { Rect } from "../geometry";
import type { Entity } from "../entity-manager";

const UUID_V7_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// Acceptance tests
// ---------------------------------------------------------------------------

describe("EditorController", () => {
  test("given an empty project, creates a default chart", () => {
    const editor = new EditorTester({ getProjectToLoad: () => makeProject() });
    const chart = editor.instance.ctx.get(ChartSlice).getSelectedChart()!;

    editor.chart.shouldHaveName("Main Chart");
    editor.chart.shouldHaveSize(15360);
    expect(chart.id).toMatch(UUID_V7_PATTERN);
    expect(chart.version).toMatch(UUID_V7_PATTERN);
    expect(chart.version).not.toBe(chart.id);
  });

  test("given a project with charts, selects the first chart", () => {
    const editor = new EditorTester({
      getProjectToLoad: () =>
        makeProject((p) => {
          p.addChart("Hard", undefined, 24000);
          p.addChart("Easy", undefined, 12000);
        }),
    });

    editor.chart.shouldHaveName("Hard");
    editor.chart.shouldHaveSize(24000);
  });

  test("reports the selected chart's size", () => {
    const editor = new EditorTester({
      getProjectToLoad: () =>
        makeProject((p) => {
          p.addChart("Custom", undefined, 9999);
        }),
    });

    editor.chart.shouldHaveSize(9999);
  });

  test("falls back to default size when chart component lacks size field", () => {
    const editor = new EditorTester({
      getProjectToLoad: () =>
        makeProject((p) => {
          p.addEntity((e) => e.with(CHART, { name: "Test" }));
        }),
    });

    editor.chart.shouldHaveSize(15360);
  });

  test("provides a default timing engine with 60 BPM and 4/4 time", () => {
    const editor = new EditorTester({ getProjectToLoad: () => makeProject() });

    // Default 4/4 measure length at 240 PPQN = 960 pulses.
    editor.timing.shouldHaveMeasureBoundaries({ start: 0, end: 2000 }, [0, 960, 1920]);
  });

  test("provides default columns", () => {
    const editor = new EditorTester({ getProjectToLoad: () => makeProject() });

    editor.columns.shouldHaveCount(4);
    editor.columns.shouldHaveTotalWidth(40 + 48 + 56 + 8 + 1);
  });

  test("columns have cumulative x positions", () => {
    const editor = new EditorTester({ getProjectToLoad: () => makeProject() });

    editor.columns.at(0).shouldMatch({ id: "measure", x: 0, width: 40 });
    editor.columns.at(1).shouldMatch({ id: "time-sig", x: 40, width: 48 });
    editor.columns.at(2).shouldMatch({ id: "bpm", x: 88, width: 56 });
    editor.columns.at(3).shouldMatch({ id: "spacer", x: 144, width: 8 });
  });

  test("adding a level increases columns; removing it restores count", () => {
    const editor = new EditorTester({
      getProjectToLoad: () =>
        makeProject((p) => {
          p.addChart("Hard", undefined, 1000);
        }),
    });

    const before = editor.columns.count;
    const chartId = editor.instance.$selectedChartId.get()!;
    const levelId = editor.instance.addLevel(chartId, "Easy", "beat-7k");
    const level = editor.instance.getEntityManager().get(levelId)!;

    expect(level.id).toMatch(UUID_V7_PATTERN);
    expect(level.version).toMatch(UUID_V7_PATTERN);
    expect(level.version).not.toBe(level.id);
    expect(editor.columns.count).toBeGreaterThan(before);

    editor.instance.removeLevel(levelId);
    expect(editor.columns.count).toBe(before);
  });

  test("hiding a level decreases columns; unhiding restores count", () => {
    const editor = new EditorTester({
      getProjectToLoad: () =>
        makeProject((p) => {
          p.addChart("Hard", undefined, 1000);
        }),
    });

    const chartId = editor.instance.$selectedChartId.get()!;
    const levelId = editor.instance.addLevel(chartId, "Easy", "beat-7k");
    const withLevel = editor.columns.count;

    editor.instance.toggleLevelVisibility(levelId);
    expect(editor.columns.count).toBeLessThan(withLevel);

    editor.instance.toggleLevelVisibility(levelId);
    expect(editor.columns.count).toBe(withLevel);
  });

  test("extracts BPM changes from entities", () => {
    const editor = new EditorTester({
      getProjectToLoad: () =>
        makeProject((p) => {
          p.addChart("Hard", (c) => {
            c.bpmChange(0, 120);
            c.bpmChange(960, 180);
          });
        }),
    });

    // At 120 BPM, 960 pulses = 4 beats = 2 seconds.
    editor.timing.atPulse(960).shouldBeAtTime("00:02.000");

    // At 180 BPM, next 960 pulses = 4 beats = 1.333... seconds.
    // Total = 2 + 1.333... = 3.333...
    editor.timing.atPulse(1920).shouldBeAtTime("00:03.333");
  });

  test("extracts time signatures from entities", () => {
    const editor = new EditorTester({
      getProjectToLoad: () =>
        makeProject((p) => {
          p.addChart("Hard", (c) => {
            c.timeSignature(0, 3, 4);
          });
        }),
    });

    // 3/4 at 240 PPQN = 3 * 240 = 720 pulses per measure.
    editor.timing.shouldHaveMeasureBoundaries({ start: 0, end: 2500 }, [0, 720, 1440, 2160]);
  });

  test("combines BPM changes and time signatures", () => {
    const editor = new EditorTester({
      getProjectToLoad: () =>
        makeProject((p) => {
          p.addChart("Hard", (c) => {
            c.bpmChange(0, 120);
            c.timeSignature(0, 3, 4);
            c.timeSignature(1440, 4, 4);
          });
        }),
    });

    // 3/4 = 720 per measure, then 4/4 = 960 per measure after pulse 1440.
    editor.timing.shouldHaveMeasureBoundaries({ start: 0, end: 3000 }, [0, 720, 1440, 2400]);
  });

  test("zoomIn increases zoom to next preset", () => {
    const editor = new EditorTester({
      getProjectToLoad: () =>
        makeProject((p) => {
          p.addChart("Hard", undefined, 1000);
        }),
    });

    expect(editor.instance.$zoom.get()).toBe(1);
    editor.instance.zoomIn();
    expect(editor.instance.$zoom.get()).toBe(1.25);
  });

  test("zoomOut decreases zoom to previous preset", () => {
    const editor = new EditorTester({
      getProjectToLoad: () =>
        makeProject((p) => {
          p.addChart("Hard", undefined, 1000);
        }),
    });

    expect(editor.instance.$zoom.get()).toBe(1);
    editor.instance.zoomOut();
    expect(editor.instance.$zoom.get()).toBe(0.75);
  });

  describe("zoom scroll compensation", () => {
    test("keeps playhead viewport position stable when zooming in", () => {
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            p.addChart("Hard", undefined, 1000);
          }),
      });
      editor.instance.$cursorPulse.set(500);
      editor.instance.$zoom.set(1);
      editor.scrollTo({ x: 0, y: 100 });

      editor.zoom(2);
      editor.playhead.shouldHavePositionRelativeToViewport(-1);
    });

    test("keeps playhead viewport position stable when zooming out", () => {
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            p.addChart("Hard", undefined, 1000);
          }),
      });
      editor.instance.$cursorPulse.set(300);
      editor.instance.$zoom.set(2);
      editor.scrollTo({ x: 0, y: 50 });

      editor.zoom(1);
      editor.playhead.shouldHavePositionRelativeToViewport(229);
    });

    test("no scroll adjustment needed when playhead is at top of chart", () => {
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            p.addChart("Hard", undefined, 1000);
          }),
      });
      editor.instance.$cursorPulse.set(1000); // top of chart
      editor.instance.$zoom.set(1);
      editor.scrollTo({ x: 0, y: 50 });

      editor.zoom(2);
      expect(editor.scrollTop).toBe(50);
    });

    test("scroll adjustment equals track height delta when playhead is at bottom", () => {
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            p.addChart("Hard", undefined, 1000);
          }),
      });
      editor.instance.$cursorPulse.set(0); // bottom of chart
      editor.instance.$zoom.set(1);
      editor.scrollTo({ x: 0, y: 0 });

      editor.zoom(2);
      // Track height doubles from 200 to 400, so scroll must increase by 200
      expect(editor.scrollTop).toBe(200);
    });
  });

  describe("hover interaction", () => {
    test("hovering on the timeline moves the playhead to the snapped pulse", () => {
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            p.addChart("Hard", undefined, 1000);
          }),
      });

      // With a 1000-pulse chart at scale 0.2, trackHeight = 200.
      // Content height = 240. With viewport 480, initial scroll = 0 (content fits).
      // Hover at viewport y=100 → contentY=100 → rawPulse = (200-100)/0.2 = 500.
      // Snap 1/16 = 60 pulses. 500/60 = 8.33 → round to 8 → 480.
      editor.pointerMove({ x: 250, y: 100 });
      editor.playhead.shouldBeAtPulse(480);
    });

    test("hovering respects the current scroll position", () => {
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            p.addChart("Hard", undefined, 15360);
          }),
      });

      // Content height = 3112, viewport = 480, initial scroll = 2632.
      // Hover at viewport y=250 → contentY=2882 → rawPulse = (3072-2882)/0.2 = 950.
      // Snap 1/16 = 60. 950/60 = 15.83 → round to 16 → 960.
      // Clamped to [0, 900] (measure end 960 minus interval 60), so 900.
      editor.pointerMove({ x: 250, y: 250 });
      editor.playhead.shouldBeAtPulse(900);
    });

    test("scrolling updates the playhead to follow the mouse position", () => {
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            p.addChart("Hard", undefined, 10000);
          }),
      });

      // trackHeight = 2000, contentHeight = 2040, initial scroll = 1560.
      // Hover at viewport y=100 → contentY=1660 → rawPulse = (2000-1660)/0.2 = 1700.
      // Snap 1/16 = 60. 1700/60 = 28.33 → 1680.
      editor.pointerMove({ x: 250, y: 100 });
      editor.playhead.shouldBeAtPulse(1680);

      // Scroll up (decrease scrollTop) by 400.
      // New scrollTop = 1160, same viewport y=100 → contentY=1260.
      // rawPulse = (2000-1260)/0.2 = 3700. Snap → 3720.
      editor.scrollTo({ x: 0, y: 1160 });
      editor.playhead.shouldBeAtPulse(3720);
    });
  });

  describe("selection", () => {
    test("clicking on a BPM change selects it", () => {
      let bpmEntity: Entity;
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            p.addChart(
              "Hard",
              (c) => {
                bpmEntity = c.bpmChange(500, 120);
              },
              1000,
            );
          }),
      });

      editor.pointerDown(Rect.center(editor.eventRect(bpmEntity!.id)));
      editor.selection.shouldContain(bpmEntity!.id);
    });

    test("clicking on a note selects it", () => {
      let noteEntity: Entity;
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            const chart = p.addChart("Hard", undefined, 1000);
            const level = p.addLevel(chart.id, "Easy", "beat-7k");
            p.addChart(
              "Hard",
              (c) => {
                noteEntity = c.note(500, 1, level.id);
              },
              1000,
            );
          }),
      });

      editor.pointerDown(Rect.center(editor.eventRect(noteEntity!.id)));
      editor.selection.shouldContain(noteEntity!.id);
    });

    test("clicking on a time signature selects it", () => {
      let tsEntity: Entity;
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            p.addChart(
              "Hard",
              (c) => {
                tsEntity = c.timeSignature(500, 3, 4);
              },
              1000,
            );
          }),
      });

      editor.pointerDown(Rect.center(editor.eventRect(tsEntity!.id)));
      editor.selection.shouldContain(tsEntity!.id);
    });

    test("clicking empty space deselects", () => {
      let bpmEntity: Entity;
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            p.addChart(
              "Hard",
              (c) => {
                bpmEntity = c.bpmChange(500, 120);
              },
              1000,
            );
          }),
      });

      editor.pointerDown(Rect.center(editor.eventRect(bpmEntity!.id)));
      editor.selection.shouldContain(bpmEntity!.id);

      editor.pointerDown({ x: 0, y: 0 });
      editor.selection.shouldBeEmpty();
    });

    test("clicking on overlapping events selects the closest by center", () => {
      let bpmA: Entity;
      let bpmB: Entity;
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            p.addChart(
              "Hard",
              (c) => {
                bpmA = c.bpmChange(500, 120);
                bpmB = c.bpmChange(503, 150);
              },
              1000,
            );
          }),
      });

      editor.pointerDown(Rect.center(editor.eventRect(bpmA!.id)));
      editor.selection.shouldContain(bpmA!.id);

      editor.pointerDown(Rect.center(editor.eventRect(bpmB!.id)));
      editor.selection.shouldContain(bpmB!.id);
    });

    test("selected event renders with highlight", () => {
      let bpmEntity: Entity;
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            p.addChart(
              "Hard",
              (c) => {
                bpmEntity = c.bpmChange(500, 120);
              },
              1000,
            );
          }),
      });

      editor.pointerDown(Rect.center(editor.eventRect(bpmEntity!.id)));
      const spec = editor.instance.$visibleRenderObjects
        .get()
        .find((s) => s.key.endsWith(`-${bpmEntity!.id}`));
      expect(spec).toBeDefined();
      expect((spec!.data as Record<string, unknown>).selected).toBe(true);
    });

    test("hit-test within tolerance selects event", () => {
      let bpmEntity: Entity;
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            p.addChart(
              "Hard",
              (c) => {
                bpmEntity = c.bpmChange(500, 120);
              },
              1000,
            );
          }),
      });

      const rect = editor.eventRect(bpmEntity!.id);
      const center = Rect.center(rect);
      // Click 3px above center (within ±4px tolerance).
      editor.pointerDown({ x: center.x, y: center.y - 3 });
      editor.selection.shouldContain(bpmEntity!.id);
    });

    test("box-selecting over two BPM changes selects both", () => {
      let bpmA: Entity;
      let bpmB: Entity;
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            p.addChart(
              "Hard",
              (c) => {
                bpmA = c.bpmChange(200, 120);
                bpmB = c.bpmChange(600, 150);
              },
              1000,
            );
          }),
      });

      // Start box-select above both markers, drag down past them.
      const rectA = editor.eventRect(bpmA!.id);
      const rectB = editor.eventRect(bpmB!.id);
      const top = Math.min(rectA.y, rectB.y) - 10;
      const bottom = Math.max(rectA.y + rectA.height, rectB.y + rectB.height) + 10;

      editor.pointerDown({ x: rectA.x + rectA.width / 2, y: top });
      editor.pointerMove({ x: rectA.x + rectA.width / 2, y: bottom });
      editor.pointerUp();

      editor.selection.shouldContain(bpmA!.id);
      editor.selection.shouldContain(bpmB!.id);
    });

    test("box-select preview highlights events before pointerup", () => {
      let bpmA: Entity;
      let bpmB: Entity;
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            p.addChart(
              "Hard",
              (c) => {
                bpmA = c.bpmChange(200, 120);
                bpmB = c.bpmChange(600, 150);
              },
              1000,
            );
          }),
      });

      const rectA = editor.eventRect(bpmA!.id);
      const rectB = editor.eventRect(bpmB!.id);
      const top = Math.min(rectA.y, rectB.y) - 10;
      const bottom = Math.max(rectA.y + rectA.height, rectB.y + rectB.height) + 10;

      editor.pointerDown({ x: rectA.x + rectA.width / 2, y: top });
      editor.pointerMove({ x: rectA.x + rectA.width / 2, y: bottom });

      // $selection should still be empty before pointerup.
      expect(editor.instance.ctx.get(SelectionSlice).$selection.get().size).toBe(0);

      // But render specs should show preview as selected.
      const specs = editor.instance.$visibleRenderObjects.get();
      const specA = specs.find((s) => s.key === `bpm-${bpmA!.id}`);
      const specB = specs.find((s) => s.key === `bpm-${bpmB!.id}`);
      expect((specA!.data as Record<string, unknown>).selected).toBe(true);
      expect((specB!.data as Record<string, unknown>).selected).toBe(true);

      editor.pointerUp();
      editor.selection.shouldContain(bpmA!.id);
      editor.selection.shouldContain(bpmB!.id);
    });

    test("box-selecting over empty space selects nothing", () => {
      let bpmEntity: Entity;
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            p.addChart(
              "Hard",
              (c) => {
                bpmEntity = c.bpmChange(500, 120);
              },
              1000,
            );
          }),
      });

      editor.pointerDown(Rect.center(editor.eventRect(bpmEntity!.id)));
      editor.selection.shouldContain(bpmEntity!.id);

      // Box-select in an empty area (different column, empty pulse range).
      const rect = editor.eventRect(bpmEntity!.id);
      editor.pointerDown({ x: rect.x + rect.width + 20, y: rect.y - 50 });
      editor.pointerMove({ x: rect.x + rect.width + 30, y: rect.y - 20 });
      editor.pointerUp();

      editor.selection.shouldBeEmpty();
    });

    test("playhead moves during box-select", () => {
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            p.addChart("Hard", undefined, 1000);
          }),
      });

      editor.pointerMove({ x: 250, y: 100 });
      const pulseBefore = editor.instance.$cursorPulse.get();

      editor.pointerDown({ x: 250, y: 150 });
      editor.pointerMove({ x: 250, y: 50 });

      expect(editor.instance.$cursorPulse.get()).not.toBe(pulseBefore);
    });

    test("shift+click adds another event to selection", () => {
      let bpmA: Entity;
      let bpmB: Entity;
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            p.addChart(
              "Hard",
              (c) => {
                bpmA = c.bpmChange(500, 120);
                bpmB = c.bpmChange(800, 150);
              },
              1000,
            );
          }),
      });

      editor.pointerDown(Rect.center(editor.eventRect(bpmA!.id)));
      editor.selection.shouldContain(bpmA!.id);

      editor.pointerDown(Rect.center(editor.eventRect(bpmB!.id)), { shiftKey: true });
      editor.selection.shouldContain(bpmA!.id);
      editor.selection.shouldContain(bpmB!.id);
    });

    test("shift+click on selected event removes it from selection", () => {
      let bpmA: Entity;
      let bpmB: Entity;
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            p.addChart(
              "Hard",
              (c) => {
                bpmA = c.bpmChange(500, 120);
                bpmB = c.bpmChange(800, 150);
              },
              1000,
            );
          }),
      });

      editor.pointerDown(Rect.center(editor.eventRect(bpmA!.id)));
      editor.pointerDown(Rect.center(editor.eventRect(bpmB!.id)), { shiftKey: true });
      editor.selection.shouldContain(bpmA!.id);
      editor.selection.shouldContain(bpmB!.id);

      editor.pointerDown(Rect.center(editor.eventRect(bpmA!.id)), { shiftKey: true });
      expect(editor.instance.ctx.get(SelectionSlice).$selection.get().has(bpmA!.id)).toBe(false);
      editor.selection.shouldContain(bpmB!.id);
    });

    test("shift+click on empty space does nothing", () => {
      let bpmEntity: Entity;
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            p.addChart(
              "Hard",
              (c) => {
                bpmEntity = c.bpmChange(500, 120);
              },
              1000,
            );
          }),
      });

      editor.pointerDown(Rect.center(editor.eventRect(bpmEntity!.id)));
      editor.selection.shouldContain(bpmEntity!.id);

      editor.pointerDown({ x: 0, y: 0 }, { shiftKey: true });
      editor.selection.shouldContain(bpmEntity!.id);
    });

    test("regular click clears multi-selection", () => {
      let bpmA: Entity;
      let bpmB: Entity;
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            p.addChart(
              "Hard",
              (c) => {
                bpmA = c.bpmChange(500, 120);
                bpmB = c.bpmChange(800, 150);
              },
              1000,
            );
          }),
      });

      editor.pointerDown(Rect.center(editor.eventRect(bpmA!.id)));
      editor.pointerDown(Rect.center(editor.eventRect(bpmB!.id)), { shiftKey: true });
      expect(editor.instance.ctx.get(SelectionSlice).$selection.get().size).toBe(2);

      editor.pointerDown(Rect.center(editor.eventRect(bpmA!.id)));
      expect(editor.instance.ctx.get(SelectionSlice).$selection.get().size).toBe(1);
      editor.selection.shouldContain(bpmA!.id);
    });
  });

  describe("delete selection", () => {
    test("deleting selected notes removes them and clears selection", () => {
      let noteA: Entity;
      let noteB: Entity;
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            const chart = p.addChart("Hard", undefined, 1000);
            const level = p.addLevel(chart.id, "Easy", "beat-7k");
            p.addChart(
              "Hard",
              (c) => {
                noteA = c.note(240, 1, level.id);
                noteB = c.note(480, 2, level.id);
              },
              1000,
            );
          }),
      });

      editor.pointerDown(Rect.center(editor.eventRect(noteA!.id)));
      editor.pointerDown(Rect.center(editor.eventRect(noteB!.id)), { shiftKey: true });
      editor.deleteSelection();

      editor.selection.shouldBeEmpty();
      const deletedA = editor.instance.getEntityManager().get(noteA!.id);
      const deletedB = editor.instance.getEntityManager().get(noteB!.id);
      expect(deletedA).toBeDefined();
      expect(deletedB).toBeDefined();
      expect(Object.keys(deletedA!.components)).toHaveLength(0);
      expect(Object.keys(deletedB!.components)).toHaveLength(0);
    });
  });

  describe("undo/redo", () => {
    test("undo restores deleted notes and re-selects visible ones", () => {
      let noteA: Entity;
      let noteB: Entity;
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            const chart = p.addChart("Hard", undefined, 1000);
            const level = p.addLevel(chart.id, "Easy", "beat-7k");
            p.addChart(
              "Hard",
              (c) => {
                noteA = c.note(240, 1, level.id);
                noteB = c.note(480, 2, level.id);
              },
              1000,
            );
          }),
      });

      editor.pointerDown(Rect.center(editor.eventRect(noteA!.id)));
      editor.pointerDown(Rect.center(editor.eventRect(noteB!.id)), { shiftKey: true });
      editor.deleteSelection();
      editor.undo();

      expect(editor.instance.getEntityManager().get(noteA!.id)).toBeDefined();
      expect(editor.instance.getEntityManager().get(noteB!.id)).toBeDefined();
      editor.selection.shouldContain(noteA!.id);
      editor.selection.shouldContain(noteB!.id);
    });

    test("redo re-deletes restored notes", () => {
      let noteA: Entity;
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            const chart = p.addChart("Hard", undefined, 1000);
            const level = p.addLevel(chart.id, "Easy", "beat-7k");
            p.addChart(
              "Hard",
              (c) => {
                noteA = c.note(240, 1, level.id);
              },
              1000,
            );
          }),
      });

      editor.pointerDown(Rect.center(editor.eventRect(noteA!.id)));
      editor.deleteSelection();
      editor.undo();
      editor.redo();

      editor.selection.shouldBeEmpty();
      const redeleted = editor.instance.getEntityManager().get(noteA!.id);
      expect(redeleted).toBeDefined();
      expect(Object.keys(redeleted!.components)).toHaveLength(0);
    });
  });

  describe("keyboard navigation", () => {
    test("navigateUp moves playhead to next snap point and scrolls up", () => {
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            p.addChart("Hard", undefined, 15360);
          }),
      });

      expect(editor.instance.$cursorPulse.get()).toBe(0);
      const initialScrollTop = editor.scrollTop;

      editor.navigateUp();

      // 1/16 snap = 60 pulses, scaleY = 0.2 → delta = 12px
      expect(editor.instance.$cursorPulse.get()).toBe(60);
      expect(editor.scrollTop).toBe(initialScrollTop - 12);
    });

    test("navigateDown moves playhead to previous snap point and scrolls down", () => {
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            p.addChart("Hard", undefined, 15360);
          }),
      });

      editor.navigateUp();
      expect(editor.instance.$cursorPulse.get()).toBe(60);
      const scrollAfterUp = editor.scrollTop;

      editor.navigateDown();

      expect(editor.instance.$cursorPulse.get()).toBe(0);
      expect(editor.scrollTop).toBe(scrollAfterUp + 12);
    });

    test("navigation keeps playhead at same viewport position", () => {
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            p.addChart("Hard", undefined, 15360);
          }),
      });

      const playheadViewportY = (pulse: number) => {
        const trackHeight = editor.instance.ctx.get(ViewportSlice).getTrackHeight();
        const scaleY = editor.instance.ctx.get(ViewportSlice).getScaleY();
        return trackHeight - pulse * scaleY - editor.scrollTop;
      };

      const beforeY = playheadViewportY(0);
      editor.navigateUp();
      const afterY = playheadViewportY(60);
      expect(afterY).toBe(beforeY);
    });
  });

  describe("pencil tool placement", () => {
    test("placing a note on a lane creates a note entity", () => {
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            const chart = p.addChart("Hard", undefined, 15360);
            const level = p.addLevel(chart.id, "Easy", "beat-7k");
            p.add(
              entity((e) =>
                e
                  .with(EVENT, { y: 0 })
                  .with(NOTE, { lane: 8 })
                  .with(LEVEL_REF, { levelId: level.id })
                  .with(CHART_REF, { chartId: chart.id }),
              ),
            );
          }),
      });

      editor.setTool("pencil");
      expect(editor.instance.$activeTool.get()).toBe("pencil");
      editor.pointerMove({ y: 392 }); // pulse 240
      expect(editor.instance.$cursorPulse.get()).toBe(240);
      const laneCol = editor.instance.ctx
        .get(ColumnsSlice)
        .$columns.get()
        .find((c) => c.laneIndex === 8);
      expect(laneCol).toBeDefined();
      expect(laneCol!.placementHandler).toBeDefined();
      editor.pointerDown({ x: 180, y: 392 }); // lane 8 (SC)

      const notes = editor.instance
        .getEntityManager()
        .entitiesWithComponent(NOTE)
        .filter((e) => (e.components.event as { y: number })?.y === 240);
      expect(notes).toHaveLength(1);
      expect((notes[0]!.components.note as { lane: number })?.lane).toBe(8);
    });

    test("placing a BPM change creates a BPM change entity with current BPM", () => {
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            p.addChart(
              "Hard",
              (c) => {
                c.bpmChange(0, 128);
              },
              15360,
            );
          }),
      });

      editor.setTool("pencil");
      editor.pointerMove({ y: 392 }); // pulse 240
      editor.pointerDown({ x: 116, y: 392 }); // BPM column

      const bpms = editor.instance
        .getEntityManager()
        .entitiesWithComponent(BPM_CHANGE)
        .filter((e) => (e.components.event as { y: number })?.y === 240);
      expect(bpms).toHaveLength(1);
      expect((bpms[0]!.components.bpmChange as { bpm: number })?.bpm).toBe(128);
    });

    test("placing a time signature creates a time signature entity with current sig", () => {
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            p.addChart(
              "Hard",
              (c) => {
                c.timeSignature(0, 4, 4);
              },
              15360,
            );
          }),
      });

      editor.setTool("pencil");
      editor.pointerMove({ y: 392 }); // pulse 240
      editor.pointerDown({ x: 64, y: 392 }); // time-sig column

      const tss = editor.instance
        .getEntityManager()
        .entitiesWithComponent(TIME_SIGNATURE)
        .filter((e) => (e.components.event as { y: number })?.y === 240);
      expect(tss).toHaveLength(1);
      expect((tss[0]!.components.timeSignature as { numerator: number })?.numerator).toBe(4);
      expect((tss[0]!.components.timeSignature as { denominator: number })?.denominator).toBe(4);
    });

    test("undo removes a placed note", () => {
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            const chart = p.addChart("Hard", undefined, 15360);
            const level = p.addLevel(chart.id, "Easy", "beat-7k");
            p.add(
              entity((e) =>
                e
                  .with(EVENT, { y: 0 })
                  .with(NOTE, { lane: 8 })
                  .with(LEVEL_REF, { levelId: level.id })
                  .with(CHART_REF, { chartId: chart.id }),
              ),
            );
          }),
      });

      editor.setTool("pencil");
      editor.pointerMove({ y: 392 });
      editor.pointerDown({ x: 180, y: 392 });

      const beforeUndo = editor.instance
        .getEntityManager()
        .entitiesWithComponent(NOTE)
        .filter((e) => (e.components.event as { y: number })?.y === 240);
      expect(beforeUndo).toHaveLength(1);

      editor.undo();

      const afterUndo = editor.instance
        .getEntityManager()
        .entitiesWithComponent(NOTE)
        .filter((e) => (e.components.event as { y: number })?.y === 240);
      expect(afterUndo).toHaveLength(0);
    });

    test("select tool returns to normal hit testing", () => {
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            p.addChart(
              "Hard",
              (c) => {
                c.note(0, 8, "level-1");
              },
              15360,
            );
          }),
      });

      editor.setTool("pencil");
      expect(editor.instance.$activeTool.get()).toBe("pencil");

      editor.setTool("select");
      expect(editor.instance.$activeTool.get()).toBe("select");
    });
  });

  describe("erase tool", () => {
    test("clicking on a note in erase mode deletes it", () => {
      let noteEntity: Entity;
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            const chart = p.addChart("Hard", undefined, 1000);
            const level = p.addLevel(chart.id, "Easy", "beat-7k");
            p.addChart(
              "Hard",
              (c) => {
                noteEntity = c.note(500, 1, level.id);
              },
              1000,
            );
          }),
      });

      editor.setTool("erase");
      editor.pointerDown(Rect.center(editor.eventRect(noteEntity!.id)));

      expect(editor.instance.getEntityManager().get(noteEntity!.id)?.components).toEqual({});
      editor.selection.shouldBeEmpty();
    });

    test("clicking on a BPM change in erase mode deletes it", () => {
      let bpmEntity: Entity;
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            p.addChart(
              "Hard",
              (c) => {
                bpmEntity = c.bpmChange(500, 128);
              },
              1000,
            );
          }),
      });

      editor.setTool("erase");
      editor.pointerDown(Rect.center(editor.eventRect(bpmEntity!.id)));

      expect(editor.instance.getEntityManager().get(bpmEntity!.id)?.components).toEqual({});
      editor.selection.shouldBeEmpty();
    });

    test("undo restores an erased note", () => {
      let noteEntity: Entity;
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            const chart = p.addChart("Hard", undefined, 1000);
            const level = p.addLevel(chart.id, "Easy", "beat-7k");
            p.addChart(
              "Hard",
              (c) => {
                noteEntity = c.note(500, 1, level.id);
              },
              1000,
            );
          }),
      });

      editor.setTool("erase");
      editor.pointerDown(Rect.center(editor.eventRect(noteEntity!.id)));
      expect(editor.instance.getEntityManager().get(noteEntity!.id)?.components).toEqual({});

      editor.undo();

      const restored = editor.instance.getEntityManager().get(noteEntity!.id);
      expect(restored?.components.note).toBeDefined();
      expect((restored?.components.note as { lane: number }).lane).toBe(1);
    });

    test("clicking empty space in erase mode does nothing", () => {
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            p.addChart("Hard", undefined, 15360);
          }),
      });

      editor.setTool("erase");
      editor.pointerDown({ x: 180, y: 392 });

      editor.selection.shouldBeEmpty();
    });
  });
});
