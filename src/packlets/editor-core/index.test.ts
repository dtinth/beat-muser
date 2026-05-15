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
  SOUND_GROUP,
  SOUND_CHANNEL,
  SOUND_EVENT,
  SoundChannelSlice,
  ChartSlice,
  SelectionSlice,
  ViewportSlice,
  ColumnsSlice,
  HistorySlice,
  ClipperSlice,
  CLIPBOARD_SCHEMA,
} from "./index";
import { Rect } from "../geometry";
import type { Entity } from "../entity-manager";
import { RenderSlice } from "./slices/render-slice";
import type { WaveformData } from "./slices/waveform-slice";
import { EditEntityUserAction } from "./user-actions";

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

    editor.columns.shouldHaveCount(5);
    editor.columns.shouldHaveTotalWidth(40 + 48 + 56 + 8 + 100 + 1);
  });

  test("columns have cumulative x positions", () => {
    const editor = new EditorTester({ getProjectToLoad: () => makeProject() });

    editor.columns.at(0).shouldMatch({ id: "measure", x: 0, width: 40 });
    editor.columns.at(1).shouldMatch({ id: "time-sig", x: 40, width: 48 });
    editor.columns.at(2).shouldMatch({ id: "bpm", x: 88, width: 56 });
    editor.columns.at(3).shouldMatch({ id: "spacer-sound", x: 144, width: 8 });
    editor.columns.at(4).shouldMatch({ id: "sound-lane-0", x: 152, width: 100 });
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

    test("shift+click on selected event preserves selection (enters drag-pending)", () => {
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
      // Clicking a selected event preserves the selection (preparing to drag)
      editor.selection.shouldContain(bpmA!.id);
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

    test("regular click on selected event preserves multi-selection", () => {
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

      // Clicking on a selected event preserves the multi-selection
      editor.pointerDown(Rect.center(editor.eventRect(bpmA!.id)));
      expect(editor.instance.ctx.get(SelectionSlice).$selection.get().size).toBe(2);
      editor.selection.shouldContain(bpmA!.id);
      editor.selection.shouldContain(bpmB!.id);
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
      expect(restored).toBeDefined();
      expect(restored!.components.note).toBeDefined();
      expect((restored!.components.note as { lane: number }).lane).toBe(1);
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

  describe("dragging events", () => {
    test("dragging a selected note moves it vertically", () => {
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

      const center = Rect.center(editor.eventRect(noteEntity!.id));
      // Drag down by 50px (timeline: down = toward earlier pulses)
      editor.pointerMove({ x: center.x, y: center.y + 50 });
      editor.pointerUp();

      const em = editor.instance.getEntityManager();
      const updated = em.get(noteEntity!.id);
      // Delta = snapped cursor pulse - hit event pulse = 300 - 500 = -200
      expect((updated!.components[EVENT.key] as { y: number }).y).toBe(300);
    });

    test("dragging multiple selected notes moves them all", () => {
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
                noteA = c.note(500, 1, level.id);
                noteB = c.note(600, 2, level.id);
              },
              1000,
            );
          }),
      });

      editor.pointerDown(Rect.center(editor.eventRect(noteA!.id)));
      editor.pointerDown(Rect.center(editor.eventRect(noteB!.id)), { shiftKey: true });
      editor.selection.shouldContain(noteA!.id);
      editor.selection.shouldContain(noteB!.id);

      const center = Rect.center(editor.eventRect(noteA!.id));
      editor.pointerMove({ x: center.x, y: center.y + 50 });
      editor.pointerUp();

      const em = editor.instance.getEntityManager();
      const updatedA = em.get(noteA!.id);
      const updatedB = em.get(noteB!.id);
      // Drag anchored to last hit event (noteB at pulse 600)
      // Delta = 300 - 600 = -300
      expect((updatedA!.components[EVENT.key] as { y: number }).y).toBe(200);
      expect((updatedB!.components[EVENT.key] as { y: number }).y).toBe(300);
    });

    test("drag with zero delta does not create an undo action", () => {
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
      editor.pointerUp();

      const history = editor.instance.ctx.get(HistorySlice).$history.get();
      expect(history.undo.length).toBe(0);
    });

    test("dragging is clamped to prevent negative pulse", () => {
      let noteEntity: Entity;
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            const chart = p.addChart("Hard", undefined, 1000);
            const level = p.addLevel(chart.id, "Easy", "beat-7k");
            p.addChart(
              "Hard",
              (c) => {
                noteEntity = c.note(60, 1, level.id);
              },
              1000,
            );
          }),
      });

      editor.pointerDown(Rect.center(editor.eventRect(noteEntity!.id)));
      const center = Rect.center(editor.eventRect(noteEntity!.id));
      // Try to drag down by a lot (would go negative)
      editor.pointerMove({ x: center.x, y: center.y + 200 });
      editor.pointerUp();

      const em = editor.instance.getEntityManager();
      const updated = em.get(noteEntity!.id);
      expect((updated!.components[EVENT.key] as { y: number }).y).toBe(0);
    });

    test("undo restores dragged notes to original position", () => {
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
      const center = Rect.center(editor.eventRect(noteEntity!.id));
      editor.pointerMove({ x: center.x, y: center.y + 50 });
      editor.pointerUp();

      const em = editor.instance.getEntityManager();
      expect((em.get(noteEntity!.id)!.components[EVENT.key] as { y: number }).y).toBe(300);

      editor.undo();
      expect((em.get(noteEntity!.id)!.components[EVENT.key] as { y: number }).y).toBe(500);
    });

    test("ghost preview renders during drag", () => {
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
      const center = Rect.center(editor.eventRect(noteEntity!.id));
      editor.pointerMove({ x: center.x, y: center.y + 50 });

      const specs = editor.instance.$visibleRenderObjects.get();
      const original = specs.find((s) => s.key === `note-${noteEntity!.id}`);
      const ghost = specs.find((s) => s.key === `note-ghost-${noteEntity!.id}`);

      expect(original).toBeDefined();
      expect(original!.opacity).toBe(0.3);
      expect(ghost).toBeDefined();
      expect(ghost!.opacity).toBe(0.5);

      editor.pointerUp();
    });
  });
  describe("horizontal dragging", () => {
    test("dragging a note to a different lane (same level)", () => {
      let noteEntity: Entity;
      let levelEntity: Entity;
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            const chart = p.addChart("Hard", undefined, 1000);
            levelEntity = p.addLevel(chart.id, "Easy", "beat-7k");
            p.addChart(
              "Hard",
              (c) => {
                noteEntity = c.note(500, 1, levelEntity.id);
              },
              1000,
            );
          }),
      });

      const fromRect = editor.eventRect(noteEntity!.id);
      editor.pointerDown(Rect.center(fromRect));
      editor.selection.shouldContain(noteEntity!.id);

      const columns = editor.instance.ctx.get(ColumnsSlice).$columns.get();
      const targetCol = columns.find((c) => c.levelId === levelEntity!.id && c.laneIndex === 3);
      expect(targetCol).toBeDefined();

      // A small vertical offset ensures the drag threshold is crossed reliably,
      // as snap-to-grid can produce small pulse deltas from the note center.
      editor.pointerMove({
        x: targetCol!.x + targetCol!.width / 2,
        y: Rect.center(fromRect).y + 10,
      });
      editor.pointerUp();

      const em = editor.instance.getEntityManager();
      const updated = em.get(noteEntity!.id);
      expect((updated!.components[NOTE.key] as { lane: number }).lane).toBe(3);
      expect((updated!.components[LEVEL_REF.key] as { levelId: string }).levelId).toBe(
        levelEntity!.id,
      );
    });

    test("dragging a note to a different level", () => {
      let noteEntity: Entity;
      let level1: Entity;
      let level2: Entity;
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            const chart = p.addChart("Hard", undefined, 1000);
            level1 = p.addLevel(chart.id, "Easy", "beat-7k");
            level2 = p.addLevel(chart.id, "Hard", "beat-5k");
            p.addChart(
              "Hard",
              (c) => {
                noteEntity = c.note(500, 1, level1.id);
              },
              1000,
            );
          }),
      });

      const fromRect = editor.eventRect(noteEntity!.id);
      editor.pointerDown(Rect.center(fromRect));
      editor.selection.shouldContain(noteEntity!.id);

      const columns = editor.instance.ctx.get(ColumnsSlice).$columns.get();
      const targetCol = columns.find((c) => c.levelId === level2!.id && c.laneIndex === 3);
      expect(targetCol).toBeDefined();

      editor.pointerMove({
        x: targetCol!.x + targetCol!.width / 2,
        y: Rect.center(fromRect).y + 10,
      });
      editor.pointerUp();

      const em = editor.instance.getEntityManager();
      const updated = em.get(noteEntity!.id);
      expect((updated!.components[NOTE.key] as { lane: number }).lane).toBe(3);
      expect((updated!.components[LEVEL_REF.key] as { levelId: string }).levelId).toBe(level2!.id);
    });

    test("ghost renders in target column during horizontal drag", () => {
      let noteEntity: Entity;
      let levelEntity: Entity;
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            const chart = p.addChart("Hard", undefined, 1000);
            levelEntity = p.addLevel(chart.id, "Easy", "beat-7k");
            p.addChart(
              "Hard",
              (c) => {
                noteEntity = c.note(500, 1, levelEntity.id);
              },
              1000,
            );
          }),
      });

      editor.pointerDown(Rect.center(editor.eventRect(noteEntity!.id)));

      const columns = editor.instance.ctx.get(ColumnsSlice).$columns.get();
      const targetCol = columns.find((c) => c.levelId === levelEntity!.id && c.laneIndex === 3);
      expect(targetCol).toBeDefined();

      const fromRect = editor.eventRect(noteEntity!.id);
      editor.pointerMove({
        x: targetCol!.x + targetCol!.width / 2,
        y: Rect.center(fromRect).y + 10,
      });

      const specs = editor.instance.$visibleRenderObjects.get();
      const ghost = specs.find((s) => s.key === `note-ghost-${noteEntity!.id}`);
      expect(ghost).toBeDefined();
      expect(ghost!.x).toBe(targetCol!.x);

      editor.pointerUp();
    });
  });

  describe("sound channel management", () => {
    test("can add a sound group with custom name", () => {
      const editor = new EditorTester();
      const groupId = editor.instance.addSoundGroup("Drums");

      const group = editor.instance.getEntityManager().get(groupId);
      expect(group).toBeDefined();
      const component = editor.instance.getEntityManager().getComponent(group!, SOUND_GROUP);
      expect(component?.name).toBe("Drums");
      expect(component?.sortOrder).toBe(0);
    });

    test("default sound group name follows GRP pattern", () => {
      const editor = new EditorTester();
      editor.instance.addSoundGroup();
      editor.instance.addSoundGroup();

      const groups = editor.instance.ctx.get(SoundChannelSlice).$soundGroups.get();
      expect(groups.map((g) => g.name)).toEqual(["GRP1", "GRP2"]);
    });

    test("can add a sound channel to a group", () => {
      const editor = new EditorTester();
      const groupId = editor.instance.addSoundGroup("Drums");
      const channelId = editor.instance.addSoundChannel(groupId);

      const channel = editor.instance.getEntityManager().get(channelId);
      expect(channel).toBeDefined();
      const component = editor.instance.getEntityManager().getComponent(channel!, SOUND_CHANNEL);
      expect(component?.soundGroupId).toBe(groupId);
      expect(component?.path).toBe("");
      expect(component?.sortOrder).toBe(0);
    });

    test("sound channel handle is computed from group name and index", () => {
      const editor = new EditorTester();
      const groupId = editor.instance.addSoundGroup("PNO");
      editor.instance.addSoundChannel(groupId);
      editor.instance.addSoundChannel(groupId);

      const channels = editor.instance.ctx.get(SoundChannelSlice).$soundChannels.get();
      expect(channels[0]!.handle).toBe("PNO-001");
      expect(channels[0]!.displayNumber).toBe("001");
      expect(channels[1]!.handle).toBe("PNO-002");
      expect(channels[1]!.displayNumber).toBe("002");
    });

    test("removing a sound channel deletes the entity", () => {
      const editor = new EditorTester();
      const groupId = editor.instance.addSoundGroup("Drums");
      const channelId = editor.instance.addSoundChannel(groupId);

      editor.instance.removeSoundChannel(channelId);

      const entity = editor.instance.getEntityManager().get(channelId);
      expect(entity).toBeDefined();
      expect(Object.keys(entity!.components)).toHaveLength(0);
    });

    test("removing a sound group removes its channels", () => {
      const editor = new EditorTester();
      const groupId = editor.instance.addSoundGroup("Drums");
      const channel1 = editor.instance.addSoundChannel(groupId);
      const channel2 = editor.instance.addSoundChannel(groupId);

      editor.instance.removeSoundGroup(groupId);

      const group = editor.instance.getEntityManager().get(groupId);
      expect(group).toBeDefined();
      expect(Object.keys(group!.components)).toHaveLength(0);
      for (const id of [channel1, channel2]) {
        const entity = editor.instance.getEntityManager().get(id);
        expect(entity).toBeDefined();
        expect(Object.keys(entity!.components)).toHaveLength(0);
      }
    });

    test("can list sound groups and channels through atoms", () => {
      const editor = new EditorTester();
      const groupId = editor.instance.addSoundGroup("Drums");
      editor.instance.addSoundChannel(groupId);
      editor.instance.addSoundChannel(groupId);

      const groups = editor.instance.ctx.get(SoundChannelSlice).$soundGroups.get();
      const channels = editor.instance.ctx.get(SoundChannelSlice).$soundChannels.get();

      expect(groups).toHaveLength(1);
      expect(groups[0]!.name).toBe("Drums");
      expect(channels).toHaveLength(2);
      expect(channels.map((c) => c.displayNumber)).toEqual(["001", "002"]);
    });

    test("selecting a sound channel enables placement on sound lanes", () => {
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            p.addChart("Hard", undefined, 15360);
          }),
      });
      const groupId = editor.instance.addSoundGroup("SFX");
      const channelId = editor.instance.addSoundChannel(groupId);

      editor.instance.ctx.get(SoundChannelSlice).setSelectedSoundChannelId(channelId);

      editor.setTool("pencil");
      editor.pointerMove({ y: 392 }); // pulse 240
      editor.pointerDown({ x: 202, y: 392 }); // sound-lane-0 center

      const events = editor.instance
        .getEntityManager()
        .entitiesWithComponent(SOUND_EVENT)
        .filter((e) => (e.components.event as { y: number })?.y === 240);
      expect(events).toHaveLength(1);
      expect((events[0]!.components.soundEvent as { soundChannelId: string })?.soundChannelId).toBe(
        channelId,
      );
      expect((events[0]!.components.soundEvent as { soundLane: number })?.soundLane).toBe(0);
    });
  });

  describe("undoable add/remove operations", () => {
    test("undo addLevel removes the level and restores previous selection", () => {
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            const chart = p.addChart("Hard", undefined, 1000);
            p.addLevel(chart.id, "Easy", "beat-7k");
          }),
      });
      const chartId = editor.instance.ctx.get(ChartSlice).$selectedChartId.get()!;
      const initialSelected = editor.instance.$selectedLevelId.get();

      editor.instance.addLevel(chartId, "Normal", "beat-5k");
      expect(editor.instance.getLevelsForChart(chartId)).toHaveLength(2);

      editor.undo();
      expect(editor.instance.getLevelsForChart(chartId)).toHaveLength(1);
      expect(editor.instance.$selectedLevelId.get()).toBe(initialSelected);
    });

    test("undo removeLevel restores the level", () => {
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            const chart = p.addChart("Hard", undefined, 1000);
            p.addLevel(chart.id, "Easy", "beat-7k");
          }),
      });
      const chartId = editor.instance.ctx.get(ChartSlice).$selectedChartId.get()!;
      const levelId = editor.instance.getLevelsForChart(chartId)[0]!.id;

      editor.instance.removeLevel(levelId);
      expect(editor.instance.getLevelsForChart(chartId)).toHaveLength(0);

      editor.undo();
      expect(editor.instance.getLevelsForChart(chartId)).toHaveLength(1);
      expect(editor.instance.getLevelsForChart(chartId)[0]!.id).toBe(levelId);
    });

    test("undo addChart removes the chart and restores previous selection", () => {
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            p.addChart("Hard", undefined, 1000);
          }),
      });
      const initialSelected = editor.instance.$selectedChartId.get();

      editor.instance.addChart("Easy", 2000);
      expect(editor.instance.getCharts()).toHaveLength(2);

      editor.undo();
      expect(editor.instance.getCharts()).toHaveLength(1);
      expect(editor.instance.$selectedChartId.get()).toBe(initialSelected);
    });

    test("undo removeChart restores the chart", () => {
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            p.addChart("Hard", undefined, 1000);
            p.addChart("Easy", undefined, 2000);
          }),
      });
      const charts = editor.instance.getCharts();
      const chartId = charts[0]!.id;

      editor.instance.removeChart(chartId);
      expect(editor.instance.getCharts()).toHaveLength(1);

      editor.undo();
      expect(editor.instance.getCharts()).toHaveLength(2);
    });

    test("undo addSoundGroup removes the group", () => {
      const editor = new EditorTester();
      editor.instance.addSoundGroup("Drums");
      expect(editor.instance.ctx.get(SoundChannelSlice).$soundGroups.get()).toHaveLength(1);

      editor.undo();
      expect(editor.instance.ctx.get(SoundChannelSlice).$soundGroups.get()).toHaveLength(0);
    });

    test("undo removeSoundGroup restores the group and its channels", () => {
      const editor = new EditorTester();
      const groupId = editor.instance.addSoundGroup("Drums");
      const channelId = editor.instance.addSoundChannel(groupId);

      editor.instance.removeSoundGroup(groupId);
      expect(editor.instance.ctx.get(SoundChannelSlice).$soundGroups.get()).toHaveLength(0);
      expect(editor.instance.ctx.get(SoundChannelSlice).$soundChannels.get()).toHaveLength(0);

      editor.undo();
      expect(editor.instance.ctx.get(SoundChannelSlice).$soundGroups.get()).toHaveLength(1);
      expect(editor.instance.ctx.get(SoundChannelSlice).$soundChannels.get()).toHaveLength(1);
      expect(editor.instance.ctx.get(SoundChannelSlice).$soundChannels.get()[0]!.id).toBe(
        channelId,
      );
    });

    test("undo addSoundChannel removes the channel", () => {
      const editor = new EditorTester();
      const groupId = editor.instance.addSoundGroup("Drums");
      editor.instance.addSoundChannel(groupId);
      expect(editor.instance.ctx.get(SoundChannelSlice).$soundChannels.get()).toHaveLength(1);

      editor.undo();
      expect(editor.instance.ctx.get(SoundChannelSlice).$soundChannels.get()).toHaveLength(0);
    });

    test("undo removeSoundChannel restores the channel", () => {
      const editor = new EditorTester();
      const groupId = editor.instance.addSoundGroup("Drums");
      const channelId = editor.instance.addSoundChannel(groupId);

      editor.instance.removeSoundChannel(channelId);
      expect(editor.instance.ctx.get(SoundChannelSlice).$soundChannels.get()).toHaveLength(0);

      editor.undo();
      expect(editor.instance.ctx.get(SoundChannelSlice).$soundChannels.get()).toHaveLength(1);
      expect(editor.instance.ctx.get(SoundChannelSlice).$soundChannels.get()[0]!.id).toBe(
        channelId,
      );
    });
  });

  describe("metadata", () => {
    test("setMetadataField updates project metadata", () => {
      const editor = new EditorTester({
        getProjectToLoad: () => makeProject(),
      });

      editor.instance.setMetadataField("title", "New Title");

      expect(editor.instance.getMetadata().title).toBe("New Title");
      expect(editor.instance.getMetadata().artist).toBe("Test");
    });

    test("undo setMetadataField restores previous value", () => {
      const editor = new EditorTester({
        getProjectToLoad: () => makeProject(),
      });

      editor.instance.setMetadataField("title", "New Title");
      expect(editor.instance.getMetadata().title).toBe("New Title");

      editor.undo();
      expect(editor.instance.getMetadata().title).toBe("Test");
    });

    test("serialize produces ProjectFile with current metadata and entities", () => {
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            p.addChart("Hard", undefined, 1000);
          }),
      });

      editor.instance.setMetadataField("title", "Serialized Title");
      const serialized = editor.instance.serialize();

      expect(serialized.metadata.title).toBe("Serialized Title");
      expect(serialized.schemaVersion).toBe(2);
      expect(serialized.entities.length).toBeGreaterThan(0);
      expect(serialized.version).toMatch(UUID_V7_PATTERN);
    });
  });

  describe("waveform slice computation", () => {
    function makeWaveformData(seconds: number): WaveformData {
      const chunkCount = Math.max(1, Math.floor(seconds * 120));
      const peak = new Float32Array(chunkCount);
      const rms = new Float32Array(chunkCount);
      for (let i = 0; i < chunkCount; i++) {
        peak[i] = (i + 1) / chunkCount;
        rms[i] = peak[i] * 0.7;
      }
      return { peak, rms, durationSec: seconds, sampleRate: 48000 };
    }

    function setChannelPath(editor: EditorTester, channelId: string, path: string): void {
      const entityManager = editor.instance.getEntityManager();
      const entity = entityManager.get(channelId);
      if (!entity) return;
      const oldComponents = structuredClone(entity.components);
      const newComponents = structuredClone(oldComponents);
      (newComponents as Record<string, unknown>)["soundChannel"] = {
        ...(oldComponents as Record<string, Record<string, unknown>>)["soundChannel"],
        path,
      };
      editor.instance.ctx
        .get(HistorySlice)
        .applyAction(
          new EditEntityUserAction(editor.instance.ctx, channelId, oldComponents, newComponents),
        );
    }

    test("no waveform slices when no waveform data is available", () => {
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            p.addChart("Hard", (c) => {
              c.bpmChange(0, 120);
            });
          }),
      });

      const renderSlice = editor.instance.ctx.get(RenderSlice);
      expect(renderSlice.$waveformSlices.get()).toHaveLength(0);
    });

    test("single sound event with waveform data produces waveform slices", () => {
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            p.addChart("Hard", (c) => {
              c.bpmChange(0, 120);
            });
          }),
      });

      const groupId = editor.instance.addSoundGroup("Drums");
      const channelId = editor.instance.addSoundChannel(groupId);
      setChannelPath(editor, channelId, "audio/kick.wav");

      editor.instance.waveform.setWaveformData("audio/kick.wav", makeWaveformData(2));

      editor.instance.ctx.get(SoundChannelSlice).setSelectedSoundChannelId(channelId);
      editor.setTool("pencil");
      editor.pointerMove({ y: 392 });
      editor.pointerDown({ x: 202, y: 392 });

      const renderSlice = editor.instance.ctx.get(RenderSlice);
      const slices = renderSlice.$waveformSlices.get();
      expect(slices.length, "should produce at least one waveform slice").toBeGreaterThan(0);
    });

    test("waveform segments are stacked bottom-to-top with no gaps", () => {
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            p.addChart("Hard", (c) => {
              c.bpmChange(0, 120);
            });
          }),
      });

      const groupId = editor.instance.addSoundGroup("Drums");
      const channelId = editor.instance.addSoundChannel(groupId);
      setChannelPath(editor, channelId, "audio/kick.wav");

      editor.instance.ctx.get(SoundChannelSlice).setSelectedSoundChannelId(channelId);
      editor.setTool("pencil");
      editor.pointerMove({ y: 392 });
      editor.pointerDown({ x: 202, y: 392 });

      editor.instance.waveform.setWaveformData("audio/kick.wav", makeWaveformData(5));

      const renderSlice = editor.instance.ctx.get(RenderSlice);
      const slices = renderSlice.$waveformSlices.get();
      expect(slices.length, "should produce at least one waveform slice").toBeGreaterThan(0);

      const sorted = [...slices].sort((a, b) => a.y - b.y);
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];
        const gap = curr.y - (prev.y + prev.rpLength);
        const label = `segment at y=${prev.y.toFixed(1)} h=${prev.rpLength.toFixed(1)} → next at y=${curr.y.toFixed(1)}`;
        expect(Math.abs(gap), label).toBeLessThan(1);
      }
    });
  });

  describe("clipboard", () => {
    test("copy serializes selected entities into clipboard format", () => {
      let bpmEntity: Entity;
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            p.addChart(
              "Hard",
              (c) => {
                bpmEntity = c.bpmChange(120, 140);
              },
              1000,
            );
          }),
      });

      editor.pointerDown(Rect.center(editor.eventRect(bpmEntity!.id)));
      editor.selection.shouldContain(bpmEntity!.id);

      const clipper = editor.instance.ctx.get(ClipperSlice);
      const entry = clipper.getClipboardEntry();
      expect(entry).not.toBeNull();
      expect(entry!.$schema).toBe(CLIPBOARD_SCHEMA);
      expect(entry!.e).toHaveLength(1);
      expect(entry!.e[0]).toHaveProperty("event");
      expect(entry!.e[0]).toHaveProperty("bpmChange");
      expect(entry!.e[0]).toHaveProperty("chartRef");
    });

    test("paste creates entities at cursor pulse with relative offsets preserved", () => {
      let bpmA: Entity;
      let bpmB: Entity;
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            p.addChart(
              "Hard",
              (c) => {
                bpmA = c.bpmChange(120, 140);
                bpmB = c.bpmChange(360, 180);
              },
              1000,
            );
          }),
      });

      editor.pointerDown(Rect.center(editor.eventRect(bpmA!.id)));
      editor.pointerDown(Rect.center(editor.eventRect(bpmB!.id)), { shiftKey: true });
      editor.selection.shouldContain(bpmA!.id);
      editor.selection.shouldContain(bpmB!.id);

      const clipper = editor.instance.ctx.get(ClipperSlice);
      const entry = clipper.getClipboardEntry();
      expect(entry).not.toBeNull();

      editor.instance.$cursorPulse.set(600);
      clipper.pasteFromEntry(entry!);

      // Two new entities should be created at pulses 600 and 840 (offset 480 from 120)
      const em = editor.instance.getEntityManager();
      const allBpmEvents = em
        .entitiesWithComponent(BPM_CHANGE)
        .filter((e) => em.getComponent(e, EVENT)!.y >= 600);
      expect(allBpmEvents).toHaveLength(2);

      const pulses = allBpmEvents.map((e) => em.getComponent(e, EVENT)!.y).sort((a, b) => a - b);
      expect(pulses[0]).toBe(600);
      expect(pulses[1]).toBe(840);

      // Pasted entities should be selected
      expect(editor.instance.ctx.get(SelectionSlice).$selection.get().size).toBe(2);
    });

    test("paste skips entities whose column does not exist in target chart", () => {
      let level5kId = "";
      let chartId = "";
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            const chart = p.addChart("Hard", undefined, 1000);
            chartId = chart.id;
            const level7k = p.addLevel(chart.id, "7K", "beat-7k");
            const level5k = p.addLevel(chart.id, "5K", "beat-5k");
            level5kId = level5k.id;
            p.addChart(
              "Hard",
              (c) => {
                c.note(240, 6, level7k.id);
              },
              1000,
            );
          }),
      });

      // Manually build a clipboard entry with notes on lanes 1 (valid) and 6 (invalid)
      const entry = {
        $schema: CLIPBOARD_SCHEMA,
        e: [
          {
            event: { y: 120 },
            note: { lane: 1 },
            levelRef: { levelId: level5kId },
            chartRef: { chartId: chartId },
          },
          {
            event: { y: 240 },
            note: { lane: 6 },
            levelRef: { levelId: level5kId },
            chartRef: { chartId: chartId },
          },
        ],
      };

      editor.instance.$cursorPulse.set(600);
      const clipper = editor.instance.ctx.get(ClipperSlice);
      clipper.pasteFromEntry(entry);

      const em = editor.instance.getEntityManager();
      const newNotes = em
        .entitiesWithComponent(NOTE)
        .filter((e) => em.getComponent(e, EVENT)!.y >= 600);
      // Only lane 1 note should be pasted (beat-5k has lanes 0-4, lane 6 is out of range)
      expect(newNotes).toHaveLength(1);
    });

    test("cut copies selection to clipboard and deletes entities in one undo step", async () => {
      let bpmEntity: Entity;
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            p.addChart(
              "Hard",
              (c) => {
                bpmEntity = c.bpmChange(120, 140);
              },
              1000,
            );
          }),
      });

      editor.pointerDown(Rect.center(editor.eventRect(bpmEntity!.id)));
      editor.selection.shouldContain(bpmEntity!.id);

      const clipper = editor.instance.ctx.get(ClipperSlice);

      // Save clipboard entry before cut (selection still intact)
      const entry = clipper.getClipboardEntry();
      expect(entry).not.toBeNull();
      expect(entry!.e).toHaveLength(1);

      // Verify cut is exactly one undo step
      const undoCountBefore = editor.instance.ctx.get(HistorySlice).$history.get().undo.length;
      await clipper.cutSelection();
      const undoCountAfter = editor.instance.ctx.get(HistorySlice).$history.get().undo.length;
      expect(undoCountAfter).toBe(undoCountBefore + 1);

      // Entity should be deleted
      const em = editor.instance.getEntityManager();
      const deleted = em.get(bpmEntity!.id);
      expect(deleted).toBeDefined();
      expect(Object.keys(deleted!.components)).toHaveLength(0);

      // Undo should restore the original entity (single undo step)
      editor.undo();
      const restored = em.get(bpmEntity!.id);
      expect(restored).toBeDefined();
      expect(Object.keys(restored!.components)).toEqual(["event", "bpmChange", "chartRef"]);
      editor.selection.shouldContain(bpmEntity!.id);

      // Paste should work independently using the saved entry
      editor.instance.$cursorPulse.set(600);
      clipper.pasteFromEntry(entry!);
      const pasted = em
        .entitiesWithComponent(BPM_CHANGE)
        .filter((e) => em.getComponent(e, EVENT)!.y === 600);
      expect(pasted).toHaveLength(1);
    });
  });
});
