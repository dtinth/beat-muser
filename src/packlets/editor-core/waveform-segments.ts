export interface WaveformSegmentSpec {
  pixelStart: number;
  pixelHeight: number;
  peak: Float32Array;
  rms: Float32Array;
}

export function computeWaveformSegments(
  peak: Float32Array,
  rms: Float32Array,
  options: {
    startChunk: number;
    chunkCount: number;
    pixelHeight: number;
    maxSegmentPixels: number;
  },
): WaveformSegmentSpec[] {
  const { startChunk, chunkCount, pixelHeight, maxSegmentPixels } = options;

  // First, compute full downsampled arrays (one per pixel)
  const downsampledPeak = new Float32Array(pixelHeight);
  const downsampledRms = new Float32Array(pixelHeight);

  for (let py = 0; py < pixelHeight; py++) {
    const chunkStart = startChunk + (py * chunkCount) / pixelHeight;
    const chunkEnd = startChunk + ((py + 1) * chunkCount) / pixelHeight;
    const ci = Math.floor(chunkStart);
    const cj = Math.ceil(chunkEnd) - 1;

    if (ci > cj) {
      // No chunks in range (edge case), use nearest
      const idx = Math.max(0, Math.min(ci, peak.length - 1));
      downsampledPeak[py] = peak[idx];
      downsampledRms[py] = rms[idx];
    } else {
      let maxPeak = -Infinity;
      let sumRms = 0;
      let count = 0;
      for (let c = ci; c <= cj && c < peak.length; c++) {
        maxPeak = Math.max(maxPeak, peak[c]);
        sumRms += rms[c];
        count++;
      }
      downsampledPeak[py] = maxPeak;
      downsampledRms[py] = count > 0 ? sumRms / count : 0;
    }
  }

  // Partition into segments
  const segments: WaveformSegmentSpec[] = [];
  for (let start = 0; start < pixelHeight; start += maxSegmentPixels) {
    const height = Math.min(maxSegmentPixels, pixelHeight - start);
    segments.push({
      pixelStart: start,
      pixelHeight: height,
      peak: downsampledPeak.subarray(start, start + height),
      rms: downsampledRms.subarray(start, start + height),
    });
  }

  return segments;
}
