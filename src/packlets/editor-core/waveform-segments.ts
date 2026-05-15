export interface WaveformSegmentSpec {
  rpStart: number;
  rpLength: number;
  getWaveformPixels(): { peak: Float32Array; rms: Float32Array };
}

export function computeWaveformSegments(
  peak: Float32Array,
  rms: Float32Array,
  options: {
    rpLength: number;
    maxSegmentPixels: number;
    getFrameRange: (
      renderingPos: number,
      rpLength: number,
    ) => { startFrame: number; endFrame: number } | null;
  },
): WaveformSegmentSpec[] {
  const { rpLength, maxSegmentPixels, getFrameRange } = options;

  if (!Number.isFinite(maxSegmentPixels) || maxSegmentPixels <= 0) {
    throw new Error("maxSegmentPixels must be > 0");
  }

  const segments: WaveformSegmentSpec[] = [];

  for (let segStart = 0; segStart < rpLength; segStart += maxSegmentPixels) {
    const segRpLength = Math.min(maxSegmentPixels, rpLength - segStart);
    const segRpStart = segStart;

    segments.push({
      rpStart: segRpStart,
      rpLength: segRpLength,
      getWaveformPixels: (() => {
        let cached: { peak: Float32Array; rms: Float32Array } | null = null;
        return () => {
          if (cached) return cached;
          cached = computePixels();
          return cached;
        };
        function computePixels() {
          const segPeak = new Float32Array(segRpLength);
          const segRms = new Float32Array(segRpLength);

          for (let rp = 0; rp < segRpLength; rp++) {
            const renderingPos = segRpStart + rp;
            const frameRange = getFrameRange(renderingPos, rpLength);

            if (!frameRange || frameRange.startFrame >= frameRange.endFrame) {
              segPeak[rp] = 0;
              segRms[rp] = 0;
              continue;
            }

            const start = Math.max(0, frameRange.startFrame);
            const end = Math.min(peak.length, rms.length, frameRange.endFrame);
            if (start >= end) {
              segPeak[rp] = 0;
              segRms[rp] = 0;
              continue;
            }

            let maxPeak = 0;
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
        }
      })(),
    });
  }

  return segments;
}
