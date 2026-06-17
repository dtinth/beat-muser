import { atom } from "nanostores";
import { Slice } from "../slice.ts";

export interface WaveformData {
  peak: Float32Array;
  rms: Float32Array;
  /** Normalized (0..1, log-frequency) spectral centroid per frame; "brightness". */
  centroid: Float32Array;
  durationSec: number;
  sampleRate: number;
}

export type WaveformStatus = "nothing" | "loading" | "decoding-failed" | "generating" | "ready";

export class WaveformSlice extends Slice {
  static override readonly sliceKey = "waveform";

  $waveformData = atom<Map<string, WaveformData>>(new Map());
  $waveformStatus = atom<Map<string, WaveformStatus>>(new Map());

  setWaveformData(path: string, data: WaveformData): void {
    const map = new Map(this.$waveformData.get());
    map.set(path, data);
    this.$waveformData.set(map);
  }

  setWaveformStatus(path: string, status: WaveformStatus): void {
    const map = new Map(this.$waveformStatus.get());
    map.set(path, status);
    this.$waveformStatus.set(map);
  }

  removeWaveformData(path: string): void {
    {
      const map = new Map(this.$waveformData.get());
      map.delete(path);
      this.$waveformData.set(map);
    }
    {
      const map = new Map(this.$waveformStatus.get());
      map.delete(path);
      this.$waveformStatus.set(map);
    }
  }
}
