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
 * - **Linear scan internally** — The engine walks measures on demand. The
 *   public interface is clean so the index strategy can be swapped later
 *   without changing callers or tests.
 */

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

  /**
   * Generates every measure start pulse, accounting for time-signature
   * interruptions. Yields indefinitely — callers must break when they have
   * enough values.
   */
  function* measureBoundariesGenerator(): Generator<number> {
    let sigIndex = 0;
    let measureStart = effectiveSigs[0].pulse;

    while (true) {
      yield measureStart;

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

      // If the next time signature falls strictly inside this measure,
      // the measure is interrupted.
      if (
        sigIndex + 1 < effectiveSigs.length &&
        effectiveSigs[sigIndex + 1].pulse < nextMeasureStart
      ) {
        sigIndex++;
        measureStart = effectiveSigs[sigIndex].pulse;
      } else {
        measureStart = nextMeasureStart;
      }
    }
  }

  /**
   * Generates every snap grid point for the given interval, resetting at
   * each measure boundary (including interrupted ones).
   */
  function* snapPointsGenerator(interval: number): Generator<number> {
    let sigIndex = 0;
    let measureStart = effectiveSigs[0].pulse;

    while (true) {
      // Advance to the time signature active at this measure start.
      while (
        sigIndex + 1 < effectiveSigs.length &&
        effectiveSigs[sigIndex + 1].pulse <= measureStart
      ) {
        sigIndex++;
      }

      const sig = effectiveSigs[sigIndex];
      const length = getMeasureLength(sig);
      const measureEnd = measureStart + length;

      // The measure may be interrupted before its natural end.
      const actualEnd =
        sigIndex + 1 < effectiveSigs.length && effectiveSigs[sigIndex + 1].pulse < measureEnd
          ? effectiveSigs[sigIndex + 1].pulse
          : measureEnd;

      let point = measureStart;
      while (point < actualEnd) {
        yield point;
        point += interval;
      }

      if (actualEnd < measureEnd) {
        // Interrupted — next measure starts at the new time signature.
        sigIndex++;
        measureStart = effectiveSigs[sigIndex].pulse;
      } else {
        measureStart = measureEnd;
      }
    }
  }

  return {
    getMeasureBoundaries({ start, end }) {
      const boundaries: number[] = [];
      for (const boundary of measureBoundariesGenerator()) {
        if (boundary >= end) break;
        if (boundary >= start) boundaries.push(boundary);
      }
      return boundaries;
    },

    getSnapPoints(snap, { start, end }) {
      const interval = parseSnapInterval(snap);
      const points: number[] = [];
      for (const point of snapPointsGenerator(interval)) {
        if (point >= end) break;
        if (point >= start) points.push(point);
      }
      return points;
    },

    pulseToSeconds(pulse) {
      if (pulse <= 0) return 0;

      let seconds = 0;
      let lastPulse = sortedBpms[0].pulse;
      let lastBpm = sortedBpms[0].bpm;

      for (let i = 1; i < sortedBpms.length; i++) {
        const change = sortedBpms[i];
        if (change.pulse >= pulse) break;

        const deltaPulse = change.pulse - lastPulse;
        seconds += (deltaPulse / PPQN) * (60 / lastBpm);
        lastPulse = change.pulse;
        lastBpm = change.bpm;
      }

      const deltaPulse = pulse - lastPulse;
      seconds += (deltaPulse / PPQN) * (60 / lastBpm);
      return seconds;
    },

    secondsToPulse(seconds) {
      if (seconds <= 0) return 0;

      let accumulated = 0;
      let lastPulse = sortedBpms[0].pulse;
      let lastBpm = sortedBpms[0].bpm;

      for (let i = 1; i < sortedBpms.length; i++) {
        const change = sortedBpms[i];
        const segmentSeconds = ((change.pulse - lastPulse) / PPQN) * (60 / lastBpm);

        if (accumulated + segmentSeconds >= seconds) {
          const remaining = seconds - accumulated;
          return lastPulse + (remaining / (60 / lastBpm)) * PPQN;
        }

        accumulated += segmentSeconds;
        lastPulse = change.pulse;
        lastBpm = change.bpm;
      }

      const remaining = seconds - accumulated;
      return lastPulse + (remaining / (60 / lastBpm)) * PPQN;
    },
  };
}
