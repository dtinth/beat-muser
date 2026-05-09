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
      renderingPos: number,
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

        for (let rp = 0; rp < segLength; rp++) {
          const renderingPos = segPixelStart + rp;
          const frameRange = getFrameRange(renderingPos, pixelLength);

          if (!frameRange || frameRange.startFrame >= frameRange.endFrame) {
            segPeak[rp] = 0;
            segRms[rp] = 0;
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
          segPeak[rp] = maxPeak;
          segRms[rp] = count > 0 ? sumRms / count : 0;
        }

        return { peak: segPeak, rms: segRms };
      },
    });
  }

  return segments;
}
