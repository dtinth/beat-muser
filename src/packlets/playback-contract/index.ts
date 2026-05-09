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
 * - `*PlaybackSec` — playback time, seconds since play was pressed.
 * - `*AudioSec` — audio time, seconds within the decoded audio file.
 */

export interface PlaybackEvent {
  /** Path to the audio file relative to the project root. */
  fileName: string;
  /**
   * When to trigger this event, in playback seconds relative to the moment
   * play was pressed (0 = the moment play began).
   */
  triggerPlaybackSec: number;
  /** Start offset into the audio file in audio seconds. */
  audioStartSec: number;
  /** End offset into the audio file in audio seconds. */
  audioEndSec: number;
}

export interface Playback {
  /**
   * Returns all PlaybackEvents whose triggerPlaybackSec falls between the
   * previously returned lookahead window and the given `lookaheadPlaybackSec`.
   *
   * Think of it like a deque: calling `getEvents(5)` returns everything up to
   * t=5; calling `getEvents(6)` afterward only returns events between t=5 and
   * t=6.
   */
  getEvents(lookaheadPlaybackSec: number): PlaybackEvent[];

  /**
   * Called by the audio engine on each tick (~25ms) with the current playback
   * time (seconds since play was pressed). The implementation converts this
   * to chart position and notifies the editor via an internal callback.
   */
  onPlaybackTimeChange(playbackSec: number): void;

  /** Aborted when playback is paused or stopped. */
  abortSignal: AbortSignal;
}
