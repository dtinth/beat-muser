import type { Playback, PlaybackEvent } from "../playback-contract";

export interface AudioPlaybackOptions {
  playback: Playback;
  rate: number;
  audioContext: AudioContext;
  buffers: Map<string, AudioBuffer>;
  masterGain: GainNode;
  channelGains: Map<string, GainNode>;
  /** Maximum lookahead in seconds (default 0.2). */
  lookaheadSec?: number;
  /** Tick interval in milliseconds (default 25). */
  tickIntervalMs?: number;
  /** Called on each tick with the current chart time in seconds. */
  onTick?: (chartTimeSec: number) => void;
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
    lookaheadSec = 0.2,
    tickIntervalMs = 25,
    onTick,
  } = options;

  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(`startAudioPlayback: rate must be a positive finite number, got ${rate}`);
  }

  const startContextTime = audioContext.currentTime;
  let tickTimer: ReturnType<typeof setInterval> | null = null;
  const activeSources: ActiveSource[] = [];
  let stopped = false;

  function stop(): void {
    if (stopped) return;
    stopped = true;
    playback.abortSignal.removeEventListener("abort", onAbort);
    if (tickTimer !== null) {
      clearInterval(tickTimer);
      tickTimer = null;
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

  const onAbort = () => stop();
  if (playback.abortSignal.aborted) return () => {};
  playback.abortSignal.addEventListener("abort", onAbort, { once: true });

  function scheduleEvents(): void {
    if (stopped) return;
    const currentContextTime = audioContext.currentTime;
    const currentChartTime = (currentContextTime - startContextTime) * rate;
    const lookaheadChartTime = currentChartTime + lookaheadSec;

    const events = playback.getEvents(lookaheadChartTime);

    onTick?.(currentChartTime);

    for (const event of events) {
      scheduleEvent(event);
    }
  }

  function scheduleEvent(event: PlaybackEvent): void {
    const buffer = buffers.get(event.fileName);
    if (!buffer) return;

    const channelGain = channelGains.get(event.fileName) ?? masterGain;

    // Convert chart time to context time
    const scheduledContextTime = startContextTime + event.triggerChartTime / rate;
    const now = audioContext.currentTime;

    if (scheduledContextTime < now) {
      // Event is in the past — skip
      // The "join mid-stream" case: audioStartTime already accounts for offset
      // Schedule immediately from the correct offset
    }

    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(channelGain);

    try {
      source.start(
        Math.max(scheduledContextTime, now),
        event.audioStartTime,
        event.audioEndTime - event.audioStartTime,
      );
    } catch {
      // Scheduling failed (e.g. negative offset)
      return;
    }

    const entry: ActiveSource = { source, gain: channelGain };
    activeSources.push(entry);

    source.onended = () => {
      const idx = activeSources.indexOf(entry);
      if (idx >= 0) activeSources.splice(idx, 1);
    };
  }

  function startTick(): void {
    if (stopped) return;
    scheduleEvents();
    if (stopped) return;
    tickTimer = setInterval(scheduleEvents, tickIntervalMs);
  }

  // Start scheduling as soon as possible
  startTick();

  return stop;
}
