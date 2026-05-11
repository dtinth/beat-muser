/**
 * @packageDocumentation
 *
 * Lightweight performance profiling packlet. Records timing events
 * across render frames with named counter groups. Exposes a nanostores
 * atom so React UI panels can subscribe and display aggregate stats.
 * Always activated — no branching in callers.
 */

import { atom } from "nanostores";

interface PerfEvent {
  renderNumber: number;
  reconcileNumber: number;
  type: string;
  duration: number;
}

interface PerfState {
  events: PerfEvent[];
  counters: { renderNumber: number; reconcileNumber: number };
}

export interface Perf {
  incrementCounter(name: "renderNumber" | "reconcileNumber"): void;
  measure<T>(type: string, fn: () => T): T;
  $state: ReturnType<typeof atom<PerfState>>;
}

export function createPerf(): Perf {
  const state: PerfState = {
    events: [],
    counters: { renderNumber: 0, reconcileNumber: 0 },
  };

  const $state = atom<PerfState>(state);

  const renderNumbers = new Set<number>();

  function evictIfNeeded() {
    if (renderNumbers.size <= 100) return;
    const min = Math.min(...renderNumbers);
    renderNumbers.delete(min);
    state.events = state.events.filter((e) => e.renderNumber !== min);
  }

  return {
    incrementCounter(name) {
      state.counters[name]++;
      if (name === "renderNumber") {
        renderNumbers.add(state.counters.renderNumber);
        evictIfNeeded();
      }
      $state.set({ ...state });
    },
    measure<T>(type: string, fn: () => T): T {
      const start = performance.now();
      const result = fn();
      const duration = performance.now() - start;
      const rn = state.counters.renderNumber;
      state.events.push({
        renderNumber: rn,
        reconcileNumber: state.counters.reconcileNumber,
        type,
        duration,
      });
      renderNumbers.add(rn);
      evictIfNeeded();
      $state.set({ ...state });
      return result;
    },
    $state,
  };
}
