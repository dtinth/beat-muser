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

  return {
    incrementCounter(name) {
      state.counters[name]++;
      $state.set({ ...state });
    },
    measure<T>(_type: string, fn: () => T): T {
      return fn();
    },
    $state,
  };
}
