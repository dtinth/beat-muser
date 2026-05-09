export interface WaveformSegmentSpec {
  pixelStart: number;
  pixelLength: number;
  getWaveformPixels(): { peak: Float32Array; rms: Float32Array };
}

export function computeWaveformSegments(
  peak: Float32Array,
  rms: Float32Array,
  options: {
    pixelLength: number;
    maxSegmentPixels: number;
    getFrameRange: (
      pixelIndex: number,
      pixelLength: number,
    ) => { startFrame: number; endFrame: number } | null;
  },
): WaveformSegmentSpec[] {
  const { pixelLength, maxSegmentPixels, getFrameRange } = options;

  const segments: WaveformSegmentSpec[] = [];

  for (let segStart = 0; segStart < pixelLength; segStart += maxSegmentPixels) {
    const segLength = Math.min(maxSegmentPixels, pixelLength - segStart);
    const segPixelStart = segStart;

    segments.push({
      pixelStart: segPixelStart,
      pixelLength: segLength,
      getWaveformPixels: () => {
        const segPeak = new Float32Array(segLength);
        const segRms = new Float32Array(segLength);

        for (let py = 0; py < segLength; py++) {
          const blockPixelIndex = segPixelStart + (segLength - 1 - py);
          const frameRange = getFrameRange(blockPixelIndex, pixelLength);

          if (!frameRange || frameRange.startFrame >= frameRange.endFrame) {
            segPeak[py] = 0;
            segRms[py] = 0;
            continue;
          }

          const start = Math.max(0, frameRange.startFrame);
          const end = Math.min(peak.length, frameRange.endFrame);

          let maxPeak = -Infinity;
          let sumRms = 0;
          let count = 0;
          for (let f = start; f < end; f++) {
            maxPeak = Math.max(maxPeak, peak[f]);
            sumRms += rms[f];
            count++;
          }
          segPeak[py] = maxPeak;
          segRms[py] = count > 0 ? sumRms / count : 0;
        }

        return { peak: segPeak, rms: segRms };
      },
    });
  }

  return segments;
}
