/**
 * @packageDocumentation
 *
 * Acceptance tests for the editor core, expressed as user-level interactions
 * against an `EditorTester` that simulates the timeline behavior layer.
 */

import { describe, expect, test } from "vite-plus/test";
import { EditorTester, makeProject } from "./tester";

// ---------------------------------------------------------------------------
// Acceptance tests
// ---------------------------------------------------------------------------

describe("EditorController", () => {
  test("given an empty project, creates a default chart", () => {
    const editor = new EditorTester({ getProjectToLoad: () => makeProject() });

    editor.chart.shouldHaveName("Untitled");
    editor.chart.shouldHaveSize(15360);
  });

  test("given a project with charts, selects the first chart", () => {
    const editor = new EditorTester({
      getProjectToLoad: () =>
        makeProject((p) => {
          p.add(p.chart("Hard", 24000));
          p.add(p.chart("Easy", 12000));
        }),
    });

    editor.chart.shouldHaveName("Hard");
    editor.chart.shouldHaveSize(24000);
  });

  test("reports the selected chart's size", () => {
    const editor = new EditorTester({
      getProjectToLoad: () =>
        makeProject((p) => {
          p.add(p.chart("Custom", 9999));
        }),
    });

    editor.chart.shouldHaveSize(9999);
  });

  test("falls back to default size when chart component lacks size field", () => {
    const chart = {
      id: "chart-no-size",
      version: "v1",
      components: { chart: { name: "Test" } },
    } as const;
    const editor = new EditorTester({ getProjectToLoad: () => makeProject([chart]) });

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

  test("extracts BPM changes from entities", () => {
    const editor = new EditorTester({
      getProjectToLoad: () =>
        makeProject((p) => {
          p.add(p.chart("Hard"));
          p.add(p.bpmChange(0, 120));
          p.add(p.bpmChange(960, 180));
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
          p.add(p.chart("Hard"));
          p.add(p.timeSignature(0, 3, 4));
        }),
    });

    // 3/4 at 240 PPQN = 3 * 240 = 720 pulses per measure.
    editor.timing.shouldHaveMeasureBoundaries({ start: 0, end: 2500 }, [0, 720, 1440, 2160]);
  });

  test("combines BPM changes and time signatures", () => {
    const editor = new EditorTester({
      getProjectToLoad: () =>
        makeProject((p) => {
          p.add(p.chart("Hard"));
          p.add(p.bpmChange(0, 120));
          p.add(p.timeSignature(0, 3, 4));
          p.add(p.timeSignature(1440, 4, 4));
        }),
    });

    // 3/4 = 720 per measure, then 4/4 = 960 per measure after pulse 1440.
    editor.timing.shouldHaveMeasureBoundaries({ start: 0, end: 3000 }, [0, 720, 1440, 2400]);
  });

  describe("zoom scroll compensation", () => {
    test("keeps playhead viewport position stable when zooming in", () => {
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            p.add(p.chart("Hard", 1000));
          }),
      });
      editor.instance.$cursorPulse.set(500);
      editor.instance.$zoom.set(1);
      editor.scrollTo(100);

      editor.zoom(2);
      editor.playhead.shouldHavePositionRelativeToViewport(-1);
    });

    test("keeps playhead viewport position stable when zooming out", () => {
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            p.add(p.chart("Hard", 1000));
          }),
      });
      editor.instance.$cursorPulse.set(300);
      editor.instance.$zoom.set(2);
      editor.scrollTo(50);

      editor.zoom(1);
      editor.playhead.shouldHavePositionRelativeToViewport(229);
    });

    test("no scroll adjustment needed when playhead is at top of chart", () => {
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            p.add(p.chart("Hard", 1000));
          }),
      });
      editor.instance.$cursorPulse.set(1000); // top of chart
      editor.instance.$zoom.set(1);
      editor.scrollTo(50);

      editor.zoom(2);
      expect(editor.scrollTop).toBe(50);
    });

    test("scroll adjustment equals track height delta when playhead is at bottom", () => {
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            p.add(p.chart("Hard", 1000));
          }),
      });
      editor.instance.$cursorPulse.set(0); // bottom of chart
      editor.instance.$zoom.set(1);
      editor.scrollTo(0);

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
            p.add(p.chart("Hard", 1000));
          }),
      });

      // With a 1000-pulse chart at scale 0.2, trackHeight = 200.
      // Content height = 240. With viewport 480, initial scroll = 0 (content fits).
      // Hover at viewport y=100 → contentY=100 → rawPulse = (200-100)/0.2 = 500.
      // Snap 1/16 = 60 pulses. 500/60 = 8.33 → round to 8 → 480.
      editor.hover({ x: 250, y: 100 });
      editor.playhead.shouldBeAtPulse(480);
    });

    test("hovering respects the current scroll position", () => {
      const editor = new EditorTester({
        getProjectToLoad: () =>
          makeProject((p) => {
            p.add(p.chart("Hard", 15360));
          }),
      });

      // Content height = 3112, viewport = 480, initial scroll = 2632.
      // Hover at viewport y=250 → contentY=2882 → rawPulse = (3072-2882)/0.2 = 950.
      // Snap 1/16 = 60. 950/60 = 15.83 → round to 16 → 960.
      // Clamped to [0, 900] (measure end 960 minus interval 60), so 900.
      editor.hover({ x: 250, y: 250 });
      editor.playhead.shouldBeAtPulse(900);
    });
  });
});
