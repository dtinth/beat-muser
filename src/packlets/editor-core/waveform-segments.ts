export interface WaveformSegmentSpec {
  pixelStart: number;
  pixelHeight: number;
  getWaveformPixels(): { peak: Float32Array; rms: Float32Array };
}

export function computeWaveformSegments(
  peak: Float32Array,
  rms: Float32Array,
  options: {
    pixelHeight: number;
    maxSegmentPixels: number;
    getFrameRange: (
      pixelIndex: number,
      pixelHeight: number,
    ) => { startFrame: number; endFrame: number } | null;
  },
): WaveformSegmentSpec[] {
  const { pixelHeight, maxSegmentPixels, getFrameRange } = options;

  const segments: WaveformSegmentSpec[] = [];

  for (let segStart = 0; segStart < pixelHeight; segStart += maxSegmentPixels) {
    const segHeight = Math.min(maxSegmentPixels, pixelHeight - segStart);
    const segPixelStart = segStart;

    segments.push({
      pixelStart: segPixelStart,
      pixelHeight: segHeight,
      getWaveformPixels: () => {
        const segPeak = new Float32Array(segHeight);
        const segRms = new Float32Array(segHeight);

        for (let py = 0; py < segHeight; py++) {
          const frameRange = getFrameRange(segPixelStart + py, pixelHeight);

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
