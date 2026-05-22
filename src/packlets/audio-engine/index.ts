/**
 * @packageDocumentation
 * Loads audio files from the project file system, decodes them via the Web Audio API,
 * computes waveform peak/RMS data, and reports results through a delegate.
 * Includes concurrency control to prevent overwhelming the browser.
 *
 * Also provides playback scheduling via `startAudioPlayback`, which consumes
 * a {@link Playback} object (from the playback-contract packlet) and schedules
 * `AudioBufferSourceNode`s against the shared `AudioContext`.
 */
export { computePeakAndRms } from "./compute-waveform.ts";
export { computeWaveformData } from "./compute-waveform-audio-buffer.ts";
export { createAudioEngine } from "./create-audio-engine.ts";
export { startAudioPlayback } from "./play-audio.ts";
export type {
  AudioEngineDelegate,
  AudioEngineFileSystem,
  WaveformData,
  WaveformStatus,
} from "./types.ts";
export type { CreateAudioEngineOptions } from "./create-audio-engine.ts";
export type { AudioPlaybackOptions } from "./play-audio.ts";
