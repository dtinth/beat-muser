import { describe, expect, test } from "vite-plus/test";
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
    expect(state.events[0]!.type).toBe("events");
    expect(state.events[0]!.renderNumber).toBe(1);
    expect(state.events[0]!.reconcileNumber).toBe(1);
    expect(state.events[0]!.duration).toBeGreaterThanOrEqual(0);
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
    expect(events[0]!.renderNumber).toBe(1);
    expect(events[0]!.reconcileNumber).toBe(0);
    expect(events[1]!.renderNumber).toBe(1);
    expect(events[1]!.reconcileNumber).toBe(0);
    expect(events[2]!.renderNumber).toBe(1);
    // reconcileNumber reflects current value at measure time
    expect(events[2]!.reconcileNumber).toBe(2);
  });
});
