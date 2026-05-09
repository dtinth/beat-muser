export function computePeakAndRms(
  channelData: Float32Array[],
  sampleRate: number,
  chunksPerSecond: number,
): { peak: Float32Array; rms: Float32Array } {
  const chunkSize = Math.floor(sampleRate / chunksPerSecond);
  if (chunkSize === 0 || channelData.length === 0) {
    return { peak: new Float32Array(0), rms: new Float32Array(0) };
  }

  const totalSamples = channelData[0].length;
  const chunkCount = Math.ceil(totalSamples / chunkSize);
  const peak = new Float32Array(chunkCount);
  const rms = new Float32Array(chunkCount);

  for (let ci = 0; ci < chunkCount; ci++) {
    computeChunk(channelData, chunkSize, totalSamples, ci, peak, rms);
  }

  return { peak, rms };
}

export function computePeakAndRmsAsync(
  channelData: Float32Array[],
  sampleRate: number,
  chunksPerSecond: number,
): Promise<{ peak: Float32Array; rms: Float32Array }> {
  const chunkSize = Math.floor(sampleRate / chunksPerSecond);
  if (chunkSize === 0 || channelData.length === 0) {
    return Promise.resolve({ peak: new Float32Array(0), rms: new Float32Array(0) });
  }

  const totalSamples = channelData[0].length;
  const chunkCount = Math.ceil(totalSamples / chunkSize);
  const peak = new Float32Array(chunkCount);
  const rms = new Float32Array(chunkCount);

  const BATCH_CHUNKS = Math.max(1, Math.floor(chunksPerSecond / 4));

  return new Promise((resolve) => {
    let batchStart = 0;

    function processBatch() {
      const batchEnd = Math.min(batchStart + BATCH_CHUNKS, chunkCount);
      for (let ci = batchStart; ci < batchEnd; ci++) {
        computeChunk(channelData, chunkSize, totalSamples, ci, peak, rms);
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
  chunkSize: number,
  totalSamples: number,
  ci: number,
  peak: Float32Array,
  rms: Float32Array,
): void {
  const start = ci * chunkSize;
  const end = Math.min(start + chunkSize, totalSamples);
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
  rms[ci] = Math.sqrt(sumSq / count);
}
