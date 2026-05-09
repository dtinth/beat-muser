/**
 * @packageDocumentation
 * Shared contract between editor-core and audio-engine for audio playback.
 *
 * Editor-core produces `Playback` objects via `createPlayback()` that describe
 * which sound events to trigger when. Audio-engine consumes `Playback` objects
 * to schedule `AudioBufferSourceNode`s against the `AudioContext` clock.
 *
 * All times are in **chart time** (real seconds, unaffected by playback rate).
 * The audio engine handles the rate multiplier when converting chart time to
 * `AudioContext.currentTime`.
 */

export interface PlaybackEvent {
  /** Path to the audio file relative to the project root. */
  fileName: string;
  /**
   * When to trigger this event, in chart time seconds.
   * This is relative to the start of playback (0 = the moment play began).
   */
  triggerChartTime: number;
  /** Start offset into the audio file in seconds. */
  audioStartTime: number;
  /** End offset into the audio file in seconds. */
  audioEndTime: number;
}

export interface Playback {
  /**
   * Returns all PlaybackEvents whose triggerChartTime falls between the
   * previously returned lookahead window and the given `lookaheadChartTime`.
   *
   * Think of it like a deque: calling `getEvents(5)` returns everything up to
   * t=5; calling `getEvents(6)` afterward only returns events between t=5 and
   * t=6.
   */
  getEvents(lookaheadChartTime: number): PlaybackEvent[];

  /** Aborted when playback is paused or stopped. */
  abortSignal: AbortSignal;
}
