import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { startAudioPlayback } from "./play-audio.ts";
import type { AudioPlaybackOptions } from "./play-audio.ts";
import type { Playback } from "../playback-contract/index.ts";

/**
 * A hand-driven `requestAnimationFrame` stand-in. `tickFrame()` runs one frame:
 * it invokes the callbacks queued so far, which (for a self-rescheduling loop)
 * queue the next frame. This lets tests advance the visual loop without touching
 * the wall clock or the audio scheduler's `setInterval`.
 */
function createFrameDriver() {
  let nextHandle = 0;
  let queued = new Map<number, () => void>();

  const requestFrame = (cb: () => void) => {
    const handle = ++nextHandle;
    queued.set(handle, cb);
    return handle;
  };
  const cancelFrame = (handle: number) => {
    queued.delete(handle);
  };
  const tickFrame = () => {
    const pending = queued;
    queued = new Map();
    for (const cb of pending.values()) cb();
  };

  return { requestFrame, cancelFrame, tickFrame, pending: () => queued.size };
}

/** A mutable fake AudioContext exposing only what startAudioPlayback reads. */
function createFakeAudioContext(): { currentTime: number } & AudioContext {
  return { currentTime: 0 } as unknown as { currentTime: number } & AudioContext;
}

function createFakePlayback(overrides: Partial<Playback> = {}): {
  playback: Playback;
  abort: () => void;
} {
  const abortController = new AbortController();
  const playback: Playback = {
    getEvents: () => [],
    onPlaybackTimeChange: () => {},
    abortSignal: abortController.signal,
    ...overrides,
  };
  return {
    playback,
    abort: () => {
      abortController.abort();
    },
  };
}

function baseOptions(
  playback: Playback,
  audioContext: AudioContext,
  driver: ReturnType<typeof createFrameDriver>,
): AudioPlaybackOptions {
  return {
    playback,
    rate: 1,
    audioContext,
    buffers: new Map(),
    masterGain: {} as GainNode,
    channelGains: new Map(),
    requestFrame: driver.requestFrame,
    cancelFrame: driver.cancelFrame,
  };
}

describe("startAudioPlayback visual loop", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("emits the initial position synchronously", () => {
    vi.useFakeTimers();
    const times: number[] = [];
    const { playback } = createFakePlayback({
      onPlaybackTimeChange: (sec) => {
        times.push(sec);
      },
    });
    const ctx = createFakeAudioContext();
    const driver = createFrameDriver();

    const stop = startAudioPlayback(baseOptions(playback, ctx, driver));

    expect(times).toEqual([0]);
    stop();
  });

  test("advances the visual position once per frame, independent of the audio tick interval", () => {
    vi.useFakeTimers();
    const times: number[] = [];
    const { playback } = createFakePlayback({
      onPlaybackTimeChange: (sec) => {
        times.push(sec);
      },
    });
    const ctx = createFakeAudioContext();
    const driver = createFrameDriver();

    const stop = startAudioPlayback({
      ...baseOptions(playback, ctx, driver),
      tickIntervalMs: 25,
    });

    // No setInterval tick has fired; only frames drive the visual position.
    ctx.currentTime = 0.008;
    driver.tickFrame();
    ctx.currentTime = 0.016;
    driver.tickFrame();
    ctx.currentTime = 0.024;
    driver.tickFrame();

    // Initial 0 plus one update per frame — 120fps-style cadence, no 25ms cap.
    expect(times).toEqual([0, 0.008, 0.016, 0.024]);
    stop();
  });

  test("keeps audio scheduling on the setInterval tick, not the frame loop", () => {
    vi.useFakeTimers();
    const getEvents = vi.fn<Playback["getEvents"]>(() => []);
    const { playback } = createFakePlayback({ getEvents });
    const ctx = createFakeAudioContext();
    const driver = createFrameDriver();

    const stop = startAudioPlayback({
      ...baseOptions(playback, ctx, driver),
      tickIntervalMs: 25,
    });

    // One synchronous scheduling pass on start.
    expect(getEvents).toHaveBeenCalledTimes(1);

    // Frames must not schedule audio.
    driver.tickFrame();
    driver.tickFrame();
    expect(getEvents).toHaveBeenCalledTimes(1);

    // Advancing the clock fires the audio scheduler.
    vi.advanceTimersByTime(25);
    expect(getEvents).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(25);
    expect(getEvents).toHaveBeenCalledTimes(3);

    stop();
  });

  test("stops the frame loop when stopped", () => {
    vi.useFakeTimers();
    const times: number[] = [];
    const { playback } = createFakePlayback({
      onPlaybackTimeChange: (sec) => {
        times.push(sec);
      },
    });
    const ctx = createFakeAudioContext();
    const driver = createFrameDriver();

    const stop = startAudioPlayback(baseOptions(playback, ctx, driver));
    ctx.currentTime = 0.008;
    driver.tickFrame();
    const countAtStop = times.length;

    stop();

    // A stray frame after stop must not emit further positions.
    ctx.currentTime = 0.016;
    driver.tickFrame();
    expect(times).toHaveLength(countAtStop);
    expect(driver.pending()).toBe(0);
  });

  test("emits nothing when the playback is already aborted", () => {
    vi.useFakeTimers();
    const times: number[] = [];
    const { playback, abort } = createFakePlayback({
      onPlaybackTimeChange: (sec) => {
        times.push(sec);
      },
    });
    abort();
    const ctx = createFakeAudioContext();
    const driver = createFrameDriver();

    startAudioPlayback(baseOptions(playback, ctx, driver));

    expect(times).toEqual([]);
    expect(driver.pending()).toBe(0);
  });
});
