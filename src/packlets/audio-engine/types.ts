export interface WaveformData {
  peak: Float32Array;
  rms: Float32Array;
  durationSeconds: number;
  sampleRate: number;
}

export type WaveformStatus = "nothing" | "loading" | "decoding-failed" | "generating" | "ready";

export interface AudioEngineDelegate {
  onWaveformStatus(path: string, status: WaveformStatus): void;
  onWaveformReady(path: string, data: WaveformData): void;
  onWaveformError(path: string, error: Error): void;
}

export interface AudioEngineFileSystem {
  readFile(path: string): Promise<ArrayBuffer>;
}
