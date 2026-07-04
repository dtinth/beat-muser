import { describe, expect, test } from "vite-plus/test";
import { percentile, avg, aggregateSamples, formatProfileReport } from "./profiler.ts";
import type { FrameSample, ProfileResult } from "./profiler.ts";

// ---------------------------------------------------------------------------
// percentile
// ---------------------------------------------------------------------------

describe("percentile", () => {
  test("returns 0 for empty array", () => {
    expect(percentile([], 50)).toBe(0);
  });

  test("returns single value for single-element array", () => {
    expect(percentile([42], 50)).toBe(42);
    expect(percentile([42], 0)).toBe(42);
    expect(percentile([42], 100)).toBe(42);
  });

  test("returns min/max for p0/p100", () => {
    const sorted = [1, 2, 3, 4, 5];
    expect(percentile(sorted, 0)).toBe(1);
    expect(percentile(sorted, 100)).toBe(5);
  });

  test("returns median for p50 with odd count", () => {
    const sorted = [10, 20, 30, 40, 50];
    expect(percentile(sorted, 50)).toBe(30);
  });

  test("interpolates between elements for p95 on 20 elements", () => {
    const sorted = Array.from({ length: 20 }, (_, i) => (i + 1) * 10); // 10..200
    const p95 = percentile(sorted, 95);
    // idx = 0.95 * 19 = 18.05 → lo=18, hi=19 → 190 + 0.05*(200-190)=190.5
    expect(p95).toBeCloseTo(190.5, 5);
  });
});

// ---------------------------------------------------------------------------
// avg
// ---------------------------------------------------------------------------

describe("avg", () => {
  test("returns 0 for empty array", () => {
    expect(avg([])).toBe(0);
  });

  test("returns value for single element", () => {
    expect(avg([7])).toBe(7);
  });

  test("returns correct average", () => {
    expect(avg([1, 2, 3, 4, 5])).toBe(3);
    expect(avg([10, 20])).toBe(15);
  });
});

// ---------------------------------------------------------------------------
// aggregateSamples
// ---------------------------------------------------------------------------

function makeSample(deltaMs: number, measureMs: number, domNodes = 50): FrameSample {
  return {
    deltaMs,
    measures: {
      "reconcile:getVisibleObjects": [measureMs * 0.6],
      "reconcile:dom": [measureMs * 0.4],
    },
    domNodeCount: domNodes,
  };
}

describe("aggregateSamples", () => {
  test("computes avgFps from frameCount and wallTimeMs", () => {
    const samples = Array.from({ length: 100 }, () => makeSample(16, 5));
    const stats = aggregateSamples(samples, 1600);
    expect(stats.avgFps).toBeCloseTo(62.5, 1);
  });

  test("computes frame delta stats", () => {
    const deltas = [10, 12, 14, 16, 20];
    const samples = deltas.map((d) => makeSample(d, 5));
    const stats = aggregateSamples(samples, 72);
    expect(stats.frameDelta.avg).toBeCloseTo(14.4, 5);
    expect(stats.frameDelta.max).toBe(20);
    // median of sorted [10,12,14,16,20] = 14
    expect(stats.frameDelta.median).toBe(14);
  });

  test("p95 is computed for frame deltas", () => {
    // 20 samples: index 19 is a spike. p95 idx = 0.95 * 19 = 18.05 → interpolates between 16 and 100.
    const samples = Array.from({ length: 20 }, (_, i) => makeSample(i === 19 ? 100 : 16, 5));
    const stats = aggregateSamples(samples, 320);
    // p95 index = 18.05 → 16 + 0.05 * (100 - 16) = 20.2
    expect(stats.frameDelta.p95).toBeGreaterThan(16);
    expect(stats.frameDelta.max).toBe(100);
  });

  test("measure breakdown aggregates across frames", () => {
    const samples = [makeSample(16, 10), makeSample(16, 20)];
    const stats = aggregateSamples(samples, 32);
    const gvo = stats.measureBreakdown.find((m) => m.type === "reconcile:getVisibleObjects");
    expect(gvo).toBeDefined();
    // 10*0.6=6, 20*0.6=12 → avg = 9
    expect(gvo!.avgMs).toBeCloseTo(9, 5);
    expect(gvo!.totalMs).toBeCloseTo(18, 5);
    expect(gvo!.callsPerFrame).toBe(1); // 2 events / 2 frames
  });

  test("unaccounted time = frame delta minus total measured", () => {
    const sample: FrameSample = {
      deltaMs: 20,
      measures: { "reconcile:getVisibleObjects": [5], "reconcile:dom": [3] },
      domNodeCount: null,
    };
    const stats = aggregateSamples([sample], 20);
    // 20 - (5 + 3) = 12
    expect(stats.unaccountedAvgMs).toBeCloseTo(12, 5);
  });

  test("unaccounted is clamped to 0 when measures exceed delta", () => {
    const sample: FrameSample = {
      deltaMs: 5,
      measures: { "reconcile:getVisibleObjects": [10] },
      domNodeCount: null,
    };
    const stats = aggregateSamples([sample], 5);
    expect(stats.unaccountedAvgMs).toBe(0);
  });

  test("dom node count is null when no samples have counts", () => {
    const sample: FrameSample = { deltaMs: 16, measures: {}, domNodeCount: null };
    const stats = aggregateSamples([sample], 16);
    expect(stats.domNodeCount.avg).toBeNull();
    expect(stats.domNodeCount.max).toBeNull();
  });

  test("dom node count is averaged and maxed", () => {
    const samples = [makeSample(16, 5, 100), makeSample(16, 5, 200)];
    const stats = aggregateSamples(samples, 32);
    expect(stats.domNodeCount.avg).toBe(150);
    expect(stats.domNodeCount.max).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// formatProfileReport
// ---------------------------------------------------------------------------

function makeResult(overrides: Partial<ProfileResult> = {}): ProfileResult {
  const samples = Array.from({ length: 100 }, () => makeSample(16.67, 5));
  return {
    framesWarmup: 10,
    framesMeasured: 100,
    samples,
    scrollCenterY: 5000,
    scrollRangeHalf: 1500,
    environment: {
      userAgent: "TestAgent/1.0",
      devicePixelRatio: 2,
      viewportWidth: 1280,
      viewportHeight: 768,
    },
    wallTimeMs: 1667,
    ...overrides,
  };
}

describe("formatProfileReport", () => {
  test("contains header", () => {
    const report = formatProfileReport(makeResult());
    expect(report).toContain("Beat Muser");
    expect(report).toContain("Performance Profile");
  });

  test("contains environment info", () => {
    const report = formatProfileReport(makeResult());
    expect(report).toContain("TestAgent/1.0");
    expect(report).toContain("1280x768");
    expect(report).toContain("2"); // devicePixelRatio
  });

  test("contains scroll range", () => {
    const report = formatProfileReport(makeResult());
    expect(report).toContain("5000"); // centerY
    expect(report).toContain("3500"); // center - half
    expect(report).toContain("6500"); // center + half
  });

  test("contains frames measured count", () => {
    const report = formatProfileReport(makeResult());
    expect(report).toContain("100");
  });

  test("contains FPS estimate", () => {
    const report = formatProfileReport(makeResult());
    // 100 frames / 1.667s ≈ 59.9 FPS
    expect(report).toMatch(/\d+\.\d\s*$/m); // some numeric fps-like value
    expect(report).toContain("Avg FPS");
  });

  test("contains measure type names", () => {
    const report = formatProfileReport(makeResult());
    expect(report).toContain("reconcile:getVisibleObjects");
    expect(report).toContain("reconcile:dom");
  });

  test("contains frame time statistics labels", () => {
    const report = formatProfileReport(makeResult());
    expect(report).toContain("avg");
    expect(report).toContain("median");
    expect(report).toContain("p95");
    expect(report).toContain("max");
  });

  test("contains DOM node count section when counts present", () => {
    const report = formatProfileReport(makeResult());
    expect(report).toContain("DOM node counts");
    expect(report).toContain("50"); // the default domNodeCount in makeSample
  });

  test("omits DOM node count section when no counts", () => {
    const samples = Array.from({ length: 5 }, () => ({
      deltaMs: 16,
      measures: {},
      domNodeCount: null,
    }));
    const report = formatProfileReport(makeResult({ samples }));
    expect(report).not.toContain("DOM node counts");
  });

  test("contains unaccounted time estimate", () => {
    const report = formatProfileReport(makeResult());
    expect(report).toContain("Unaccounted");
  });
});
