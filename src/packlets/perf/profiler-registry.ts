/**
 * @packageDocumentation
 *
 * Module-level registry that holds the active {@link ProfilerTarget} so that
 * UI triggers (Debug tab, command palette, `window` API) can reach the
 * scrollable canvas without importing editor-specific code.
 *
 * At most one target is active at a time (the mounted timeline canvas).
 * Registration is cleared when the canvas unmounts via the returned disposer.
 */

import type { ProfilerTarget } from "./profiler.ts";

let activeTarget: ProfilerTarget | null = null;

/** Register the active profiler target. Returns a disposer that clears it. */
export function setProfilerTarget(target: ProfilerTarget): () => void {
  activeTarget = target;
  return () => {
    if (activeTarget === target) {
      activeTarget = null;
    }
  };
}

/** Get the currently registered profiler target, or null if none mounted. */
export function getProfilerTarget(): ProfilerTarget | null {
  return activeTarget;
}
