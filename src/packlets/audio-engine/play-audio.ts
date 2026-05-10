import type { Playback, PlaybackEvent } from "../playback-contract";

export interface AudioPlaybackOptions {
  playback: Playback;
  rate: number;
  audioContext: AudioContext;
  buffers: Map<string, AudioBuffer>;
  masterGain: GainNode;
  channelGains: Map<string, GainNode>;
  /** Lookahead window size in playback seconds (default 0.2). */
  lookaheadPlaybackSec?: number;
  /** Tick interval in milliseconds (default 25). */
  tickIntervalMs?: number;
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
    const currentPlaybackSec = (currentContextTime - startContextTime) * rate;
    const lookaheadPlaybackSec = currentPlaybackSec + window;

    const events = playback.getEvents(lookaheadPlaybackSec);

    playback.onPlaybackTimeChange(currentPlaybackSec);

    for (const event of events) {
      scheduleEvent(event);
    }
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

  startTick();

  return stop;
}
