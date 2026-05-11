import { describe, expect, test } from "vite-plus/test";
import { createPerf } from "./index";

describe("perf", () => {
  test("incrementCounter increments counter values", () => {
    const perf = createPerf();

    perf.incrementCounter("renderNumber");
    expect(perf.$state.get().counters.renderNumber).toBe(1);
    expect(perf.$state.get().counters.reconcileNumber).toBe(0);
  });
});
