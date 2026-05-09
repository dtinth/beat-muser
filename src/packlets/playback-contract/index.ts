/**
 * @packageDocumentation
 * Shared contract between editor-core and audio-engine for audio playback.
 *
 * Editor-core produces `Playback` objects via `createPlayback()` that describe
 * which sound events to trigger when. Audio-engine consumes `Playback` objects
 * to schedule `AudioBufferSourceNode`s against the `AudioContext` clock.
 *
 * All times follow the project's coordinate-space suffix conventions
 * (see `docs/coordinate-spaces.md`):
 * - `*ChartSec` — chart time, seconds since song start, independent of rate.
 * - `*AudioSec` — audio time, seconds within the decoded audio file.
 *
 * The audio engine handles the rate multiplier when converting chart time to
 * `AudioContext.currentTime`.
 */

export interface PlaybackEvent {
  /** Path to the audio file relative to the project root. */
  fileName: string;
  /**
   * When to trigger this event, in chart time seconds relative to the moment
   * play began (0 = the moment play was pressed).
   */
  triggerChartSec: number;
  /** Start offset into the audio file in audio seconds. */
  audioStartSec: number;
  /** End offset into the audio file in audio seconds. */
  audioEndSec: number;
}

export interface Playback {
  /**
   * Returns all PlaybackEvents whose triggerChartSec falls between the
   * previously returned lookahead window and the given `lookaheadChartSec`.
   *
   * Think of it like a deque: calling `getEvents(5)` returns everything up to
   * t=5; calling `getEvents(6)` afterward only returns events between t=5 and
   * t=6.
   */
  getEvents(lookaheadChartSec: number): PlaybackEvent[];

  /** Aborted when playback is paused or stopped. */
  abortSignal: AbortSignal;
}
