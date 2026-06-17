import { computePeakAndRmsAsync } from "./compute-waveform.ts";
import type { WaveformData } from "./types.ts";

const CHUNKS_PER_SECOND = 120;

export async function computeWaveformData(audioBuffer: AudioBuffer): Promise<WaveformData> {
  const channelData: Float32Array[] = [];
  for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
    channelData.push(audioBuffer.getChannelData(c));
  }

  const { peak, rms, centroid } = await computePeakAndRmsAsync(
    channelData,
    audioBuffer.sampleRate,
    CHUNKS_PER_SECOND,
  );

  return {
    peak,
    rms,
    centroid,
    durationSec: audioBuffer.duration,
    sampleRate: audioBuffer.sampleRate,
  };
}
