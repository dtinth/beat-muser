export function computePeakAndRms(
  channelData: Float32Array[],
  sampleRate: number,
  framesPerSec: number,
): { peak: Float32Array; rms: Float32Array } {
  if (sampleRate <= 0 || framesPerSec <= 0) {
    throw new Error("sampleRate and framesPerSec must be positive");
  }
  if (channelData.length === 0) {
    return { peak: new Float32Array(0), rms: new Float32Array(0) };
  }

  const totalSamples = channelData[0].length;
  const chunkCount = Math.max(0, Math.ceil((totalSamples * framesPerSec) / sampleRate));
  if (chunkCount === 0) {
    return { peak: new Float32Array(0), rms: new Float32Array(0) };
  }
  const peak = new Float32Array(chunkCount);
  const rms = new Float32Array(chunkCount);

  for (let ci = 0; ci < chunkCount; ci++) {
    const start = Math.round((ci * sampleRate) / framesPerSec);
    const end = Math.min(Math.round(((ci + 1) * sampleRate) / framesPerSec), totalSamples);
    computeChunk(channelData, start, end, ci, peak, rms);
  }

  return { peak, rms };
}

export function computePeakAndRmsAsync(
  channelData: Float32Array[],
  sampleRate: number,
  framesPerSec: number,
): Promise<{ peak: Float32Array; rms: Float32Array }> {
  if (sampleRate <= 0 || framesPerSec <= 0) {
    throw new Error("sampleRate and framesPerSec must be positive");
  }
  if (channelData.length === 0) {
    return Promise.resolve({ peak: new Float32Array(0), rms: new Float32Array(0) });
  }

  const totalSamples = channelData[0].length;
  const chunkCount = Math.max(0, Math.ceil((totalSamples * framesPerSec) / sampleRate));
  if (chunkCount === 0) {
    return Promise.resolve({ peak: new Float32Array(0), rms: new Float32Array(0) });
  }
  const peak = new Float32Array(chunkCount);
  const rms = new Float32Array(chunkCount);

  const BATCH_CHUNKS = Math.max(1, Math.floor(framesPerSec / 4));

  return new Promise((resolve) => {
    let batchStart = 0;

    function processBatch() {
      const batchEnd = Math.min(batchStart + BATCH_CHUNKS, chunkCount);
      for (let ci = batchStart; ci < batchEnd; ci++) {
        const start = Math.round((ci * sampleRate) / framesPerSec);
        const end = Math.min(Math.round(((ci + 1) * sampleRate) / framesPerSec), totalSamples);
        computeChunk(channelData, start, end, ci, peak, rms);
      }

      batchStart = batchEnd;
      if (batchStart < chunkCount) {
        setTimeout(processBatch, 0);
      } else {
        resolve({ peak, rms });
      }
    }

    processBatch();
  });
}

function computeChunk(
  channelData: Float32Array[],
  start: number,
  end: number,
  ci: number,
  peak: Float32Array,
  rms: Float32Array,
): void {
  let maxPeak = 0;
  let sumSq = 0;

  for (let si = start; si < end; si++) {
    let amplitude = 0;
    for (let ch = 0; ch < channelData.length; ch++) {
      amplitude = Math.max(amplitude, Math.abs(channelData[ch][si]));
    }
    maxPeak = Math.max(maxPeak, amplitude);
    sumSq += amplitude * amplitude;
  }

  const count = end - start;
  peak[ci] = maxPeak;
  rms[ci] = count > 0 ? Math.sqrt(sumSq / count) : 0;
}
