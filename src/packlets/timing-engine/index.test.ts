/**
 * Unit tests for the timing engine.
 *
 * These tests lock down the externally observable behavior so the internal
 * index strategy (currently linear scan) can be swapped later without
 * breaking anything.
 */

import { describe, it, expect } from "vite-plus/test";
import { createTimingEngine } from "./index";

// ---------------------------------------------------------------------------
// getMeasureBoundaries
// ---------------------------------------------------------------------------

describe("getMeasureBoundaries", () => {
  it("generates 4/4 measures when no explicit time signatures are given", () => {
    const engine = createTimingEngine([], []);
    // 4/4 at 60 BPM default; each measure = 4 beats = 960 pulses
    expect(engine.getMeasureBoundaries({ start: 0, end: 3000 })).toEqual([0, 960, 1920, 2880]);
  });

  it("respects a 4/4 time signature at pulse 0", () => {
    const engine = createTimingEngine([], [{ pulse: 0, numerator: 4, denominator: 4 }]);
    expect(engine.getMeasureBoundaries({ start: 0, end: 2000 })).toEqual([0, 960, 1920]);
  });

  it("interrupts a measure when a new time signature appears mid-measure", () => {
    // 4/4 measure [0, 960) interrupted at pulse 200 by 2/4.
    const engine = createTimingEngine(
      [],
      [
        { pulse: 0, numerator: 4, denominator: 4 },
        { pulse: 200, numerator: 2, denominator: 4 },
      ],
    );
    // After interruption at 200, 2/4 measures continue: 200, 680, 1160...
    expect(engine.getMeasureBoundaries({ start: 0, end: 1500 })).toEqual([0, 200, 680, 1160]);
  });

  it("handles multiple time signature interruptions", () => {
    const engine = createTimingEngine(
      [],
      [
        { pulse: 0, numerator: 4, denominator: 4 },
        { pulse: 200, numerator: 2, denominator: 4 },
        { pulse: 960, numerator: 3, denominator: 4 },
      ],
    );
    // 4/4 [0,960) interrupted at 200 → 2/4 [200,680), [680,1160) interrupted at 960
    // → 3/4 [960,1680)
    expect(engine.getMeasureBoundaries({ start: 0, end: 1800 })).toEqual([0, 200, 680, 960, 1680]);
  });

  it("treats a time signature at an exact measure boundary as a normal transition", () => {
    // 4/4 at 0, next 3/4 at 960 (exactly at the first measure boundary).
    const engine = createTimingEngine(
      [],
      [
        { pulse: 0, numerator: 4, denominator: 4 },
        { pulse: 960, numerator: 3, denominator: 4 },
      ],
    );
    expect(engine.getMeasureBoundaries({ start: 0, end: 2000 })).toEqual([0, 960, 1680]);
  });

  it("filters boundaries to the requested range", () => {
    const engine = createTimingEngine([], []);
    expect(engine.getMeasureBoundaries({ start: 500, end: 1500 })).toEqual([960]);
  });
});

// ---------------------------------------------------------------------------
// getSnapPoints
// ---------------------------------------------------------------------------

describe("getSnapPoints", () => {
  it("generates 1/4 snap points inside a 4/4 measure", () => {
    const engine = createTimingEngine([], []);
    // 1/4 = one snap per quarter note = 240 pulses
    expect(engine.getSnapPoints("1/4", { start: 0, end: 960 })).toEqual([0, 240, 480, 720]);
  });

  it("generates 1/8 snap points inside a 4/4 measure", () => {
    const engine = createTimingEngine([], []);
    // 1/8 = 120 pulses
    expect(engine.getSnapPoints("1/8", { start: 0, end: 960 })).toEqual([
      0, 120, 240, 360, 480, 600, 720, 840,
    ]);
  });

  it("resets the snap grid at a time-signature interruption", () => {
    // 4/4 [0,960) interrupted at 200 by 2/4.
    const engine = createTimingEngine(
      [],
      [
        { pulse: 0, numerator: 4, denominator: 4 },
        { pulse: 200, numerator: 2, denominator: 4 },
      ],
    );
    // 1/4 snap = 240 pulse interval
    expect(engine.getSnapPoints("1/4", { start: 0, end: 1000 })).toEqual([0, 200, 440, 680, 920]);
  });

  it("filters snap points to the requested range", () => {
    const engine = createTimingEngine([], []);
    expect(engine.getSnapPoints("1/4", { start: 300, end: 700 })).toEqual([480]);
  });

  it("throws on invalid snap format", () => {
    const engine = createTimingEngine([], []);
    expect(() => engine.getSnapPoints("2/4", { start: 0, end: 100 })).toThrow(
      "Invalid snap format",
    );
    expect(() => engine.getSnapPoints("foo", { start: 0, end: 100 })).toThrow(
      "Invalid snap format",
    );
  });

  it("throws when snap does not yield an integer pulse interval", () => {
    const engine = createTimingEngine([], []);
    // 1/3 → 960/3 = 320 (integer), but the user's intent is that 1/3 is not a
    // quarter-note subdivision. The engine currently accepts any snap that
    // produces an integer interval; callers (toolbar) are responsible for
    // enforcing the quarter-note-subdivision policy.
    expect(() => engine.getSnapPoints("1/3", { start: 0, end: 100 })).not.toThrow();
    expect(engine.getSnapPoints("1/3", { start: 0, end: 1000 })).toEqual([0, 320, 640, 960]);

    // 1/7 → 960/7 = 137.14… (not integer) → throw
    expect(() => engine.getSnapPoints("1/7", { start: 0, end: 100 })).toThrow(
      "does not produce an integer pulse interval",
    );
  });
});

// ---------------------------------------------------------------------------
// pulseToSeconds
// ---------------------------------------------------------------------------

describe("pulseToSeconds", () => {
  it("converts pulses to seconds at a constant 60 BPM", () => {
    const engine = createTimingEngine([{ pulse: 0, bpm: 60 }], []);
    // 240 pulses = 1 beat = 1 second at 60 BPM
    expect(engine.pulseToSeconds(0)).toBe(0);
    expect(engine.pulseToSeconds(240)).toBe(1);
    expect(engine.pulseToSeconds(960)).toBe(4);
    expect(engine.pulseToSeconds(1920)).toBe(8);
  });

  it("handles a single BPM change", () => {
    const engine = createTimingEngine(
      [
        { pulse: 0, bpm: 60 },
        { pulse: 960, bpm: 120 },
      ],
      [],
    );
    // 0-960 at 60 BPM = 4s
    expect(engine.pulseToSeconds(960)).toBe(4);
    // 960-1920 at 120 BPM = 2s → total 6s
    expect(engine.pulseToSeconds(1920)).toBe(6);
    // 960-1440 at 120 BPM = 1s → total 5s
    expect(engine.pulseToSeconds(1440)).toBe(5);
  });

  it("handles multiple BPM changes", () => {
    const engine = createTimingEngine(
      [
        { pulse: 0, bpm: 60 },
        { pulse: 480, bpm: 120 },
        { pulse: 1440, bpm: 60 },
      ],
      [],
    );
    // 0-480 at 60 = 2s
    // 480-1440 at 120 = 2s → total 4s at 1440
    // 1440-1920 at 60 = 2s → total 6s at 1920
    expect(engine.pulseToSeconds(480)).toBe(2);
    expect(engine.pulseToSeconds(1440)).toBe(4);
    expect(engine.pulseToSeconds(1920)).toBe(6);
  });

  it("defaults to 60 BPM when no BPM changes are provided", () => {
    const engine = createTimingEngine([], []);
    expect(engine.pulseToSeconds(960)).toBe(4);
  });

  it("returns 0 for negative pulse", () => {
    const engine = createTimingEngine([{ pulse: 0, bpm: 60 }], []);
    expect(engine.pulseToSeconds(-100)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// secondsToPulse
// ---------------------------------------------------------------------------

describe("secondsToPulse", () => {
  it("converts seconds to pulses at a constant 60 BPM", () => {
    const engine = createTimingEngine([{ pulse: 0, bpm: 60 }], []);
    expect(engine.secondsToPulse(0)).toBe(0);
    expect(engine.secondsToPulse(1)).toBe(240);
    expect(engine.secondsToPulse(4)).toBe(960);
  });

  it("handles a single BPM change", () => {
    const engine = createTimingEngine(
      [
        { pulse: 0, bpm: 60 },
        { pulse: 960, bpm: 120 },
      ],
      [],
    );
    expect(engine.secondsToPulse(4)).toBe(960);
    expect(engine.secondsToPulse(5)).toBe(1440);
    expect(engine.secondsToPulse(6)).toBe(1920);
  });

  it("round-trips accurately through pulseToSeconds", () => {
    const engine = createTimingEngine(
      [
        { pulse: 0, bpm: 60 },
        { pulse: 960, bpm: 120 },
        { pulse: 1920, bpm: 180 },
      ],
      [],
    );
    const testPulses = [0, 240, 480, 960, 1200, 1440, 1920, 2400];
    for (const p of testPulses) {
      const s = engine.pulseToSeconds(p);
      const p2 = engine.secondsToPulse(s);
      expect(p2).toBeCloseTo(p, 10);
    }
  });

  it("defaults to 60 BPM when no BPM changes are provided", () => {
    const engine = createTimingEngine([], []);
    expect(engine.secondsToPulse(4)).toBe(960);
  });

  it("returns 0 for negative seconds", () => {
    const engine = createTimingEngine([{ pulse: 0, bpm: 60 }], []);
    expect(engine.secondsToPulse(-1)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// snapPulse
// ---------------------------------------------------------------------------

describe("snapPulse", () => {
  it("snaps to the nearest 1/4 grid point", () => {
    const engine = createTimingEngine([], []);
    // 4/4 measure, 1/4 snap = 240 pulses per snap.
    expect(engine.snapPulse(0, "1/4")).toBe(0);
    expect(engine.snapPulse(119, "1/4")).toBe(0);
    expect(engine.snapPulse(120, "1/4")).toBe(240); // ties round up
    expect(engine.snapPulse(121, "1/4")).toBe(240);
    expect(engine.snapPulse(239, "1/4")).toBe(240);
    expect(engine.snapPulse(240, "1/4")).toBe(240);
  });

  it("snaps to the nearest 1/16 grid point", () => {
    const engine = createTimingEngine([], []);
    // 1/16 snap = 60 pulses per snap.
    expect(engine.snapPulse(29, "1/16")).toBe(0);
    expect(engine.snapPulse(31, "1/16")).toBe(60);
    expect(engine.snapPulse(60, "1/16")).toBe(60);
  });

  it("resets snap phase at each measure boundary", () => {
    const engine = createTimingEngine(
      [],
      [
        { pulse: 0, numerator: 4, denominator: 4 },
        { pulse: 960, numerator: 3, denominator: 4 },
      ],
    );
    // Measure 1: 4/4 [0, 960), 1/4 snap = 240.
    expect(engine.snapPulse(720, "1/4")).toBe(720);
    // Measure 2: 3/4 [960, 1680), 1/4 snap = 240.
    // Grid points: 960, 1200, 1440, 1680.
    expect(engine.snapPulse(1080, "1/4")).toBe(1200); // 1080 is closer to 1200 (120 away) than 960 (120 away), ties round up
    expect(engine.snapPulse(1200, "1/4")).toBe(1200);
  });
});

// ---------------------------------------------------------------------------
// getMeasureAtPulse
// ---------------------------------------------------------------------------

describe("getMeasureAtPulse", () => {
  it("returns measure index and boundaries for a pulse", () => {
    const engine = createTimingEngine([], []);
    // 4/4 measures: [0, 960), [960, 1920), [1920, 2880)
    expect(engine.getMeasureAtPulse(0)).toEqual({
      measureIndex: 0,
      measureStart: 0,
      measureEnd: 960,
    });
    expect(engine.getMeasureAtPulse(959)).toEqual({
      measureIndex: 0,
      measureStart: 0,
      measureEnd: 960,
    });
    expect(engine.getMeasureAtPulse(960)).toEqual({
      measureIndex: 1,
      measureStart: 960,
      measureEnd: 1920,
    });
    expect(engine.getMeasureAtPulse(1500)).toEqual({
      measureIndex: 1,
      measureStart: 960,
      measureEnd: 1920,
    });
  });

  it("handles time signature interruptions", () => {
    const engine = createTimingEngine(
      [],
      [
        { pulse: 0, numerator: 4, denominator: 4 },
        { pulse: 960, numerator: 3, denominator: 4 },
      ],
    );
    // Measure 0: [0, 960), Measure 1: [960, 1680)
    expect(engine.getMeasureAtPulse(0)).toEqual({
      measureIndex: 0,
      measureStart: 0,
      measureEnd: 960,
    });
    expect(engine.getMeasureAtPulse(1200)).toEqual({
      measureIndex: 1,
      measureStart: 960,
      measureEnd: 1680,
    });
  });
});

// ---------------------------------------------------------------------------
// getBpmAtPulse
// ---------------------------------------------------------------------------

describe("getBpmAtPulse", () => {
  it("returns default 60 BPM when no changes are given", () => {
    const engine = createTimingEngine([], []);
    expect(engine.getBpmAtPulse(0)).toBe(60);
    expect(engine.getBpmAtPulse(1000)).toBe(60);
  });

  it("returns the BPM of the active segment", () => {
    const engine = createTimingEngine(
      [
        { pulse: 0, bpm: 120 },
        { pulse: 960, bpm: 150 },
      ],
      [],
    );
    expect(engine.getBpmAtPulse(0)).toBe(120);
    expect(engine.getBpmAtPulse(959)).toBe(120);
    expect(engine.getBpmAtPulse(960)).toBe(150);
    expect(engine.getBpmAtPulse(2000)).toBe(150);
  });
});

// ---------------------------------------------------------------------------
// getTimeSignatureAtPulse
// ---------------------------------------------------------------------------

describe("getTimeSignatureAtPulse", () => {
  it("returns default 4/4 when no signatures are given", () => {
    const engine = createTimingEngine([], []);
    expect(engine.getTimeSignatureAtPulse(0)).toEqual({
      pulse: 0,
      numerator: 4,
      denominator: 4,
    });
  });

  it("returns the active time signature", () => {
    const engine = createTimingEngine(
      [],
      [
        { pulse: 0, numerator: 4, denominator: 4 },
        { pulse: 960, numerator: 3, denominator: 4 },
      ],
    );
    expect(engine.getTimeSignatureAtPulse(0)).toEqual({
      pulse: 0,
      numerator: 4,
      denominator: 4,
    });
    expect(engine.getTimeSignatureAtPulse(959)).toEqual({
      pulse: 0,
      numerator: 4,
      denominator: 4,
    });
    expect(engine.getTimeSignatureAtPulse(960)).toEqual({
      pulse: 960,
      numerator: 3,
      denominator: 4,
    });
  });
});
