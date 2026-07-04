/**
 * @packageDocumentation
 *
 * In-app performance profiler. Drives a configurable number of
 * requestAnimationFrame frames while programmatically scrolling through the
 * densest region of the song, collects per-frame timings, and returns a
 * structured result plus a human-readable plain-text report.
 *
 * The profiler target interface is intentionally minimal so this module stays
 * decoupled from editor-specific code.
 */

import { perf } from "./index.ts";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Abstracts the scrollable canvas so the profiler stays decoupled. */
export interface ProfilerTarget {
  setScroll(point: { x: number; y: number }): void;
  getScrollInfo(): {
    scrollTop: number;
    scrollLeft: number;
    viewportWidth: number;
    viewportHeight: number;
    contentHeight: number;
  };
  getDomNodeCount?(): number;
}

export interface FrameSample {
  /** Wall-clock delta from the previous rAF callback, in ms. */
  deltaMs: number;
  /** Per-measure-type JS durations recorded during this frame. */
  measures: Record<string, number[]>;
  /** DOM node count of the scroll layer at the end of the frame (if available). */
  domNodeCount: number | null;
}

export interface ProfileResult {
  framesWarmup: number;
  framesMeasured: number;
  samples: FrameSample[];
  scrollCenterY: number;
  scrollRangeHalf: number;
  environment: {
    userAgent: string;
    devicePixelRatio: number;
    viewportWidth: number;
    viewportHeight: number;
  };
  wallTimeMs: number;
}

export interface ProfileOptions {
  warmupFrames?: number;
  measureFrames?: number;
  scrollRangeHalf?: number;
}

// ---------------------------------------------------------------------------
// Statistics helpers (pure — unit-testable)
// ---------------------------------------------------------------------------

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (idx - lo);
}

export function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/** Aggregate per-frame samples into summary statistics. */
export interface AggregatedStats {
  frameCount: number;
  wallTimeMs: number;
  avgFps: number;
  frameDelta: { avg: number; median: number; p95: number; max: number };
  measureBreakdown: {
    type: string;
    callsPerFrame: number;
    avgMs: number;
    totalMs: number;
  }[];
  unaccountedAvgMs: number;
  domNodeCount: { avg: number | null; max: number | null };
}

export function aggregateSamples(samples: FrameSample[], wallTimeMs: number): AggregatedStats {
  const frameCount = samples.length;
  const avgFps = wallTimeMs > 0 ? (frameCount / wallTimeMs) * 1000 : 0;

  const deltas = samples.map((s) => s.deltaMs);
  const sortedDeltas = [...deltas].sort((a, b) => a - b);

  const frameDelta = {
    avg: avg(deltas),
    median: percentile(sortedDeltas, 50),
    p95: percentile(sortedDeltas, 95),
    max: sortedDeltas[sortedDeltas.length - 1] ?? 0,
  };

  // Aggregate per-measure-type across all frames
  const typeMap = new Map<string, number[]>();
  for (const sample of samples) {
    for (const [type, durations] of Object.entries(sample.measures)) {
      let arr = typeMap.get(type);
      if (!arr) {
        arr = [];
        typeMap.set(type, arr);
      }
      arr.push(...durations);
    }
  }

  const measureBreakdown = Array.from(typeMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([type, durations]) => ({
      type,
      callsPerFrame: durations.length / frameCount,
      avgMs: avg(durations),
      totalMs: durations.reduce((a, b) => a + b, 0),
    }));

  // Unaccounted = frame delta minus sum of all JS measures per frame
  const unaccountedPerFrame = samples.map((s) => {
    const totalMeasured = Object.values(s.measures)
      .flat()
      .reduce((a, b) => a + b, 0);
    return Math.max(0, s.deltaMs - totalMeasured);
  });
  const unaccountedAvgMs = avg(unaccountedPerFrame);

  const domCounts = samples.map((s) => s.domNodeCount).filter((n): n is number => n !== null);
  const domNodeCount =
    domCounts.length > 0
      ? { avg: avg(domCounts), max: Math.max(...domCounts) }
      : { avg: null, max: null };

  return {
    frameCount,
    wallTimeMs,
    avgFps,
    frameDelta,
    measureBreakdown,
    unaccountedAvgMs,
    domNodeCount,
  };
}

// ---------------------------------------------------------------------------
// Report formatter (pure — unit-testable)
// ---------------------------------------------------------------------------

function pad(s: string, width: number): string {
  return s.padEnd(width);
}

function rpad(s: string, width: number): string {
  return s.padStart(width);
}

export function formatProfileReport(result: ProfileResult): string {
  const stats = aggregateSamples(result.samples, result.wallTimeMs);
  const lines: string[] = [];

  lines.push("=".repeat(60));
  lines.push("Beat Muser — Render Performance Profile");
  lines.push("=".repeat(60));
  lines.push("");
  lines.push("Environment");
  lines.push("-".repeat(40));
  lines.push(`  User agent      : ${result.environment.userAgent}`);
  lines.push(`  Device pixel ratio: ${result.environment.devicePixelRatio}`);
  lines.push(
    `  Viewport         : ${result.environment.viewportWidth}x${result.environment.viewportHeight}`,
  );
  lines.push("");
  lines.push("Scroll range profiled");
  lines.push("-".repeat(40));
  const centerY = result.scrollCenterY;
  const half = result.scrollRangeHalf;
  lines.push(`  Content center Y : ${centerY.toFixed(0)} px`);
  lines.push(
    `  Scroll range     : ${(centerY - half).toFixed(0)}..${(centerY + half).toFixed(0)} px`,
  );
  lines.push("");
  lines.push("Summary");
  lines.push("-".repeat(40));
  lines.push(`  Warmup frames    : ${result.framesWarmup}`);
  lines.push(`  Frames measured  : ${stats.frameCount}`);
  lines.push(`  Wall time        : ${stats.wallTimeMs.toFixed(1)} ms`);
  lines.push(`  Avg FPS          : ${stats.avgFps.toFixed(1)}`);
  lines.push("");
  lines.push("Frame time (ms)");
  lines.push("-".repeat(40));
  lines.push(`  avg   : ${rpad(stats.frameDelta.avg.toFixed(2), 8)}`);
  lines.push(`  median: ${rpad(stats.frameDelta.median.toFixed(2), 8)}`);
  lines.push(`  p95   : ${rpad(stats.frameDelta.p95.toFixed(2), 8)}`);
  lines.push(`  max   : ${rpad(stats.frameDelta.max.toFixed(2), 8)}`);
  lines.push("");
  lines.push("JS measure breakdown (avg ms per call, total ms)");
  lines.push("-".repeat(60));
  const col1 = 32;
  const col2 = 10;
  const col3 = 10;
  const col4 = 10;
  lines.push(
    `  ${pad("type", col1)}${rpad("calls/f", col2)}${rpad("avg ms", col3)}${rpad("total ms", col4)}`,
  );
  lines.push(`  ${"-".repeat(col1 + col2 + col3 + col4)}`);
  for (const m of stats.measureBreakdown) {
    lines.push(
      `  ${pad(m.type, col1)}${rpad(m.callsPerFrame.toFixed(2), col2)}${rpad(m.avgMs.toFixed(3), col3)}${rpad(m.totalMs.toFixed(1), col4)}`,
    );
  }
  lines.push("");
  lines.push(`  Unaccounted (layout/paint est): ${stats.unaccountedAvgMs.toFixed(2)} ms/frame`);
  lines.push("");

  if (stats.domNodeCount.avg !== null) {
    lines.push("DOM node counts (scroll layer)");
    lines.push("-".repeat(40));
    lines.push(`  avg: ${stats.domNodeCount.avg.toFixed(1)}`);
    lines.push(`  max: ${stats.domNodeCount.max!.toFixed(0)}`);
    lines.push("");
  }

  lines.push("=".repeat(60));
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Core runner
// ---------------------------------------------------------------------------

/**
 * Run a render profile against the given target.
 *
 * Caller is responsible for ensuring audio/content readiness before calling.
 */
export function runRenderProfile(
  target: ProfilerTarget,
  options: ProfileOptions = {},
): Promise<ProfileResult> {
  const warmupFrames = options.warmupFrames ?? 10;
  const measureFrames = options.measureFrames ?? 100;
  const scrollRangeHalf = options.scrollRangeHalf ?? 1500;

  return new Promise((resolve) => {
    const info = target.getScrollInfo();
    const contentHeight = info.contentHeight;
    const centerY = contentHeight / 2;

    const totalFrames = warmupFrames + measureFrames;
    let frameIndex = 0;
    const samples: FrameSample[] = [];
    let lastT = 0;
    let wallStart = 0;

    // Snapshot the current perf event watermark so we can isolate events
    // emitted during profiling without destructively clearing global state.
    let lastEventCount = perf.$state.get().events.length;

    function frameLoop(t: number) {
      if (frameIndex === warmupFrames) {
        wallStart = performance.now();
        // Reset our event watermark at the start of the measured run.
        lastEventCount = perf.$state.get().events.length;
        lastT = t;
      }

      // Compute scroll position: linearly sweep centerY ± scrollRangeHalf
      const progress = frameIndex / (totalFrames - 1);
      const scrollY = centerY - scrollRangeHalf + progress * 2 * scrollRangeHalf;
      target.setScroll({ x: 0, y: Math.max(0, scrollY) });

      frameIndex++;

      if (frameIndex > warmupFrames) {
        // Collect perf events emitted since last frame
        const allEvents = perf.$state.get().events;
        const frameEvents = allEvents.slice(lastEventCount);
        lastEventCount = allEvents.length;

        const measures: Record<string, number[]> = {};
        for (const ev of frameEvents) {
          let arr = measures[ev.type];
          if (!arr) {
            arr = [];
            measures[ev.type] = arr;
          }
          arr.push(ev.duration);
        }

        const deltaMs = t - lastT;
        const domNodeCount = target.getDomNodeCount?.() ?? null;

        samples.push({ deltaMs, measures, domNodeCount });
        lastT = t;
      }

      if (frameIndex < totalFrames) {
        requestAnimationFrame(frameLoop);
      } else {
        const wallTimeMs = performance.now() - wallStart;
        const scrollInfo = target.getScrollInfo();
        resolve({
          framesWarmup: warmupFrames,
          framesMeasured: measureFrames,
          samples,
          scrollCenterY: centerY,
          scrollRangeHalf,
          environment: {
            userAgent: navigator.userAgent,
            devicePixelRatio: window.devicePixelRatio,
            viewportWidth: scrollInfo.viewportWidth,
            viewportHeight: scrollInfo.viewportHeight,
          },
          wallTimeMs,
        });
      }
    }

    requestAnimationFrame((t) => {
      lastT = t;
      requestAnimationFrame(frameLoop);
    });
  });
}
