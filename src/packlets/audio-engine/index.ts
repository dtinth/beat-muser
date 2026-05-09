/**
 * @packageDocumentation
 * Loads audio files from the project file system, decodes them via the Web Audio API,
 * computes waveform peak/RMS data, and reports results through a delegate.
 * Includes concurrency control to prevent overwhelming the browser.
 */
export { computePeakAndRms } from "./compute-waveform";
export { computeWaveformData } from "./compute-waveform-audio-buffer";
export { createAudioEngine } from "./create-audio-engine";
export type {
  AudioEngineDelegate,
  AudioEngineFileSystem,
  WaveformData,
  WaveformStatus,
} from "./types";
export type { CreateAudioEngineOptions } from "./create-audio-engine";
