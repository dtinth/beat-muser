/**
 * @packageDocumentation
 *
 * Pure, headless timing engine for computing measure boundaries, snap grid
 * points, and pulse↔seconds conversion from BPM changes and time signature
 * events.
 *
 * All functions operate on plain numeric pulse positions. There is no
 * dependency on React, the DOM, or ECS entities.
 *
 * ## Design principles
 *
 * - **Measure-relative snap grid** — Snap points reset at every measure
 *   boundary, including interrupted measures.
 * - **Time signatures interrupt immediately** — A new time signature at pulse
 *   `P` starts a new measure at `P`, cutting the previous measure short.
 * - **BPM is independent from time signature** — Measure boundaries are
 *   determined solely by time signatures; BPM only affects real-time
 *   conversion.
 * - **Precomputed arrays with binary search** — Measure boundaries and BPM
 *   segments are stored as sorted arrays. Queries use binary search for
 *   O(log n) lookup.
 */

import { bisectLeft, bisectRight, bisectRightBy } from "../binary-search";

const PPQN = 240;

export interface BpmChange {
  pulse: number;
  bpm: number;
}

export interface TimeSignature {
  pulse: number;
  numerator: number;
  denominator: number;
}

export interface TimingEngine {
  /** Returns measure start pulses in `[start, end)`. */
  getMeasureBoundaries(range: { start: number; end: number }): number[];

  /** Returns snap grid points in `[start, end)` for the given snap setting. */
  getSnapPoints(snap: string, range: { start: number; end: number }): number[];

  /** Converts a pulse position to seconds using the piecewise BPM curve. */
  pulseToSeconds(pulse: number): number;

  /** Converts seconds to the corresponding pulse position. */
  secondsToPulse(seconds: number): number;
}

function getMeasureLength(sig: TimeSignature): number {
  return (sig.numerator * 4 * PPQN) / sig.denominator;
}

function parseSnapInterval(snap: string): number {
  const match = snap.match(/^1\/(\d+)$/);
  if (!match) {
    throw new Error(`Invalid snap format: ${snap}`);
  }
  const n = parseInt(match[1], 10);
  if (n <= 0) {
    throw new Error(`Invalid snap denominator: ${n}`);
  }
  const interval = (4 * PPQN) / n;
  if (!Number.isInteger(interval)) {
    throw new Error(`Snap ${snap} does not produce an integer pulse interval`);
  }
  return interval;
}

interface BpmSegment {
  startPulse: number;
  startSeconds: number;
  bpm: number;
}

export function createTimingEngine(
  bpmChanges: BpmChange[],
  timeSignatures: TimeSignature[],
): TimingEngine {
  const sortedBpms = [...bpmChanges].sort((a, b) => a.pulse - b.pulse);
  const sortedSigs = [...timeSignatures].sort((a, b) => a.pulse - b.pulse);

  if (sortedBpms.length === 0) {
    sortedBpms.push({ pulse: 0, bpm: 60 });
  }

  // Implicit 4/4 at pulse 0 when no explicit signature is present.
  const effectiveSigs: TimeSignature[] =
    sortedSigs.length > 0 && sortedSigs[0].pulse === 0
      ? sortedSigs
      : [{ pulse: 0, numerator: 4, denominator: 4 }, ...sortedSigs];

  // Precompute BPM segments.
  const bpmSegments: BpmSegment[] = [];
  let accumulatedSeconds = 0;
  for (let i = 0; i < sortedBpms.length; i++) {
    bpmSegments.push({
      startPulse: sortedBpms[i].pulse,
      startSeconds: accumulatedSeconds,
      bpm: sortedBpms[i].bpm,
    });
    if (i + 1 < sortedBpms.length) {
      const deltaPulse = sortedBpms[i + 1].pulse - sortedBpms[i].pulse;
      accumulatedSeconds += (deltaPulse / PPQN) * (60 / sortedBpms[i].bpm);
    }
  }

  // Lazily-computed measure boundaries.
  const boundaries: number[] = [];
  let boundariesComputedUpTo = -Infinity;

  function findSigIndex(pulse: number): number {
    let lo = 0;
    let hi = effectiveSigs.length - 1;
    while (lo < hi) {
      const mid = Math.floor((lo + hi + 1) / 2);
      if (effectiveSigs[mid].pulse <= pulse) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    return lo;
  }

  function computeNextBoundary(measureStart: number, sigIndex: number): [number, number] {
    // Advance to the time signature active at this measure start.
    while (
      sigIndex + 1 < effectiveSigs.length &&
      effectiveSigs[sigIndex + 1].pulse <= measureStart
    ) {
      sigIndex++;
    }

    const sig = effectiveSigs[sigIndex];
    const length = getMeasureLength(sig);
    const nextMeasureStart = measureStart + length;

    if (
      sigIndex + 1 < effectiveSigs.length &&
      effectiveSigs[sigIndex + 1].pulse < nextMeasureStart
    ) {
      return [effectiveSigs[sigIndex + 1].pulse, sigIndex + 1];
    }
    return [nextMeasureStart, sigIndex];
  }

  function ensureBoundariesUpTo(targetPulse: number) {
    if (targetPulse <= boundariesComputedUpTo) return;

    let measureStart: number;
    let sigIndex: number;

    if (boundaries.length === 0) {
      measureStart = effectiveSigs[0].pulse;
      sigIndex = 0;
    } else {
      measureStart = boundaries[boundaries.length - 1];
      sigIndex = findSigIndex(measureStart);
      [measureStart, sigIndex] = computeNextBoundary(measureStart, sigIndex);
    }

    while (measureStart <= targetPulse) {
      boundaries.push(measureStart);
      [measureStart, sigIndex] = computeNextBoundary(measureStart, sigIndex);
    }

    boundariesComputedUpTo = measureStart;
  }

  return {
    getMeasureBoundaries({ start, end }) {
      ensureBoundariesUpTo(end);
      const left = bisectLeft(boundaries, start);
      const right = bisectLeft(boundaries, end);
      return boundaries.slice(left, right);
    },

    getSnapPoints(snap, { start, end }) {
      const interval = parseSnapInterval(snap);
      ensureBoundariesUpTo(end);

      const points: number[] = [];
      let measureIdx = bisectRight(boundaries, start) - 1;
      if (measureIdx < 0) measureIdx = 0;

      while (measureIdx < boundaries.length && boundaries[measureIdx] < end) {
        const measureStart = boundaries[measureIdx];
        const measureEnd =
          measureIdx + 1 < boundaries.length
            ? boundaries[measureIdx + 1]
            : computeNextBoundary(measureStart, findSigIndex(measureStart))[0];

        const rangeStart = Math.max(start, measureStart);
        let point = measureStart + Math.ceil((rangeStart - measureStart) / interval) * interval;

        while (point < Math.min(end, measureEnd)) {
          points.push(point);
          point += interval;
        }

        measureIdx++;
      }

      return points;
    },

    pulseToSeconds(pulse) {
      if (pulse <= 0) return 0;
      const idx = Math.max(0, bisectRightBy(bpmSegments, pulse, (s) => s.startPulse) - 1);
      const seg = bpmSegments[idx];
      const deltaPulse = pulse - seg.startPulse;
      return seg.startSeconds + (deltaPulse / PPQN) * (60 / seg.bpm);
    },

    secondsToPulse(seconds) {
      if (seconds <= 0) return 0;
      const idx = bisectRightBy(bpmSegments, seconds, (s) => s.startSeconds) - 1;
      const seg = bpmSegments[idx];
      const remaining = seconds - seg.startSeconds;
      return seg.startPulse + (remaining / (60 / seg.bpm)) * PPQN;
    },
  };
}
