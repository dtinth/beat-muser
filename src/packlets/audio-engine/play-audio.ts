import type { Playback, PlaybackEvent } from "../playback-contract/index.ts";

export interface AudioPlaybackOptions {
  playback: Playback;
  rate: number;
  audioContext: AudioContext;
  buffers: Map<string, AudioBuffer>;
  masterGain: GainNode;
  channelGains: Map<string, GainNode>;
  /** Lookahead window size in playback seconds (default 0.2). */
  lookaheadPlaybackSec?: number;
  /** Audio-scheduling tick interval in milliseconds (default 25). */
  tickIntervalMs?: number;
  /**
   * Schedules a visual-position frame (default `requestAnimationFrame`). The
   * visual loop is decoupled from the audio tick so playback follows the
   * display's native refresh rate (60Hz, 120Hz on ProMotion, …) instead of
   * being capped at the ~40Hz audio scheduler.
   */
  requestFrame?: (callback: () => void) => number;
  /** Cancels a scheduled frame (default `cancelAnimationFrame`). */
  cancelFrame?: (handle: number) => void;
}

interface ActiveSource {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

export function startAudioPlayback(options: AudioPlaybackOptions): () => void {
  const {
    playback,
    rate,
    audioContext,
    buffers,
    masterGain,
    channelGains,
    lookaheadPlaybackSec: window = 0.2,
    tickIntervalMs = 25,
    requestFrame = (callback: () => void) => globalThis.requestAnimationFrame(callback),
    cancelFrame = (handle: number) => {
      globalThis.cancelAnimationFrame(handle);
    },
  } = options;

  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(`startAudioPlayback: rate must be a positive finite number, got ${rate}`);
  }

  const startContextTime = audioContext.currentTime;
  let tickTimer: ReturnType<typeof setInterval> | null = null;
  let frameHandle: number | null = null;
  const activeSources: ActiveSource[] = [];
  let stopped = false;

  function currentPlaybackSec(): number {
    return (audioContext.currentTime - startContextTime) * rate;
  }

  function stop(): void {
    if (stopped) return;
    stopped = true;
    playback.abortSignal.removeEventListener("abort", onAbort);
    if (tickTimer !== null) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
    if (frameHandle !== null) {
      cancelFrame(frameHandle);
      frameHandle = null;
    }
    for (const { source } of activeSources) {
      try {
        source.stop();
      } catch {
        // Already stopped
      }
    }
    activeSources.length = 0;
  }

  const onAbort = () => {
    stop();
  };
  if (playback.abortSignal.aborted) return () => {};
  playback.abortSignal.addEventListener("abort", onAbort, { once: true });

  // Audio scheduling runs on a coarse lookahead timer — it only needs to queue
  // notes *ahead* of the clock, so smoothness is irrelevant here.
  function scheduleEvents(): void {
    if (stopped) return;
    const lookaheadPlaybackSec = currentPlaybackSec() + window;

    const events = playback.getEvents(lookaheadPlaybackSec);

    for (const event of events) {
      scheduleEvent(event);
    }
  }

  // Visual position runs on its own frame loop so the playhead/scroll follow
  // the display's refresh rate rather than the 25ms audio tick. Reading
  // `audioContext.currentTime` per frame keeps it exactly in sync with audio.
  function updateVisualTime(): void {
    if (stopped) return;
    playback.onPlaybackTimeChange(currentPlaybackSec());
  }

  function frameLoop(): void {
    if (stopped) return;
    updateVisualTime();
    if (stopped) return;
    frameHandle = requestFrame(frameLoop);
  }

  function scheduleEvent(event: PlaybackEvent): void {
    const buffer = buffers.get(event.fileName);
    if (!buffer) return;

    const channelGain = channelGains.get(event.fileName) ?? masterGain;

    const scheduledContextTime = startContextTime + event.triggerPlaybackSec / rate;
    const now = audioContext.currentTime;

    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    source.connect(channelGain);

    try {
      source.start(
        Math.max(scheduledContextTime, now),
        event.audioStartSec,
        event.audioEndSec - event.audioStartSec,
      );
    } catch {
      return;
    }

    const entry: ActiveSource = { source, gain: channelGain };
    activeSources.push(entry);

    source.addEventListener(
      "ended",
      () => {
        const idx = activeSources.indexOf(entry);
        if (idx >= 0) activeSources.splice(idx, 1);
      },
      { once: true },
    );
  }

  function start(): void {
    if (stopped) return;
    // Schedule imminent audio and emit the initial position synchronously.
    scheduleEvents();
    if (stopped) return;
    updateVisualTime();
    if (stopped) return;
    tickTimer = setInterval(scheduleEvents, tickIntervalMs);
    frameHandle = requestFrame(frameLoop);
  }

  start();

  return stop;
}
