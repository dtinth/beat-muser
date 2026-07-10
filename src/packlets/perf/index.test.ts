import { describe, expect, test, vi } from "vite-plus/test";
import { createPerf } from "./index.ts";

describe("perf", () => {
  test("incrementCounter increments renderNumber", () => {
    const perf = createPerf();

    perf.incrementCounter("renderNumber");
    expect(perf.$state.get().counters.renderNumber).toBe(1);
    expect(perf.$state.get().counters.reconcileNumber).toBe(0);
  });

  test("incrementCounter increments reconcileNumber independently", () => {
    const perf = createPerf();

    perf.incrementCounter("reconcileNumber");
    perf.incrementCounter("reconcileNumber");
    perf.incrementCounter("renderNumber");

    expect(perf.$state.get().counters.renderNumber).toBe(1);
    expect(perf.$state.get().counters.reconcileNumber).toBe(2);
  });

  test("measure calls fn, returns result, and records event with duration", () => {
    const perf = createPerf();
    perf.incrementCounter("renderNumber");
    perf.incrementCounter("reconcileNumber");

    const result = perf.measure("events", () => 42);
    expect(result).toBe(42);

    const state = perf.$state.get();
    expect(state.events).toHaveLength(1);
    expect(state.events[0].type).toBe("events");
    expect(state.events[0].renderNumber).toBe(1);
    expect(state.events[0].reconcileNumber).toBe(1);
    expect(state.events[0].duration).toBeGreaterThanOrEqual(0);
  });

  test("evicts oldest events when exceeding 100 render number groups", () => {
    const perf = createPerf();

    // Produce 101 groups with one event each
    for (let i = 0; i < 101; i++) {
      perf.incrementCounter("renderNumber");
      perf.measure("test", () => {});
    }

    const state = perf.$state.get();
    // Events from renderNumber 1 should be evicted
    const renderNumbers = [...new Set(state.events.map((e) => e.renderNumber))];
    expect(renderNumbers).not.toContain(1);
    expect(renderNumbers).toContain(2);
    expect(renderNumbers).toContain(101);
    expect(renderNumbers.length).toBe(100);
  });

  test("onEvent delivers every event, unaffected by eviction", () => {
    const perf = createPerf();
    const seen: string[] = [];
    const unsubscribe = perf.onEvent((event) => {
      seen.push(event.type);
    });

    // Exceed the 100-render eviction cap; the listener must still see all.
    for (let i = 0; i < 105; i++) {
      perf.incrementCounter("renderNumber");
      perf.measure(`t${i}`, () => {});
    }
    expect(seen).toHaveLength(105);
    expect(seen[0]).toBe("t0");
    expect(seen[104]).toBe("t104");

    unsubscribe();
    perf.incrementCounter("renderNumber");
    perf.measure("after", () => {});
    expect(seen).toHaveLength(105);
  });

  test("two quick measure() calls trigger at most one atom notification after the flush delay", () => {
    vi.useFakeTimers();
    try {
      // Use a non-zero interval so notifications are coalesced
      const perf = createPerf({ notifyIntervalMs: 100 });
      let notifyCount = 0;
      const unsub = perf.$state.subscribe(() => {
        notifyCount++;
      });
      // nanostores calls subscriber immediately on subscribe — reset
      notifyCount = 0;

      perf.incrementCounter("renderNumber");
      perf.measure("a", () => {});
      perf.measure("b", () => {});

      // No flush yet — notifications should be 0
      expect(notifyCount).toBe(0);

      // Advance timers to flush
      vi.runAllTimers();
      expect(notifyCount).toBe(1);

      unsub();
    } finally {
      vi.useRealTimers();
    }
  });

  test("multiple measure calls within same render share the render number", () => {
    const perf = createPerf();

    perf.incrementCounter("renderNumber"); // renderNumber = 1
    perf.measure("a", () => {});
    perf.measure("b", () => {});
    perf.incrementCounter("reconcileNumber");
    perf.incrementCounter("reconcileNumber");
    perf.measure("c", () => {});

    const events = perf.$state.get().events;
    expect(events).toHaveLength(3);
    expect(events[0].renderNumber).toBe(1);
    expect(events[0].reconcileNumber).toBe(0);
    expect(events[1].renderNumber).toBe(1);
    expect(events[1].reconcileNumber).toBe(0);
    expect(events[2].renderNumber).toBe(1);
    // reconcileNumber reflects current value at measure time
    expect(events[2].reconcileNumber).toBe(2);
  });
});
