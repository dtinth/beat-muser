export function computePeakAndRms(
  channelData: Float32Array[],
  sampleRate: number,
  framesPerSec: number,
): { peak: Float32Array; rms: Float32Array; centroid: Float32Array } {
  if (sampleRate <= 0 || framesPerSec <= 0) {
    throw new Error("sampleRate and framesPerSec must be positive");
  }
  if (channelData.length === 0) {
    return {
      peak: new Float32Array(0),
      rms: new Float32Array(0),
      centroid: new Float32Array(0),
    };
  }

  const totalSamples = channelData[0].length;
  const chunkCount = Math.max(0, Math.ceil((totalSamples * framesPerSec) / sampleRate));
  if (chunkCount === 0) {
    return {
      peak: new Float32Array(0),
      rms: new Float32Array(0),
      centroid: new Float32Array(0),
    };
  }
  const peak = new Float32Array(chunkCount);
  const rms = new Float32Array(chunkCount);
  const centroid = new Float32Array(chunkCount);
  const scratch = createFftScratch();

  for (let ci = 0; ci < chunkCount; ci++) {
    const start = Math.round((ci * sampleRate) / framesPerSec);
    const end = Math.min(Math.round(((ci + 1) * sampleRate) / framesPerSec), totalSamples);
    computeChunk(channelData, start, end, ci, sampleRate, peak, rms, centroid, scratch);
  }

  return { peak, rms, centroid };
}

export function computePeakAndRmsAsync(
  channelData: Float32Array[],
  sampleRate: number,
  framesPerSec: number,
): Promise<{ peak: Float32Array; rms: Float32Array; centroid: Float32Array }> {
  if (sampleRate <= 0 || framesPerSec <= 0) {
    throw new Error("sampleRate and framesPerSec must be positive");
  }
  if (channelData.length === 0) {
    return Promise.resolve({
      peak: new Float32Array(0),
      rms: new Float32Array(0),
      centroid: new Float32Array(0),
    });
  }

  const totalSamples = channelData[0].length;
  const chunkCount = Math.max(0, Math.ceil((totalSamples * framesPerSec) / sampleRate));
  if (chunkCount === 0) {
    return Promise.resolve({
      peak: new Float32Array(0),
      rms: new Float32Array(0),
      centroid: new Float32Array(0),
    });
  }
  const peak = new Float32Array(chunkCount);
  const rms = new Float32Array(chunkCount);
  const centroid = new Float32Array(chunkCount);
  const scratch = createFftScratch();

  const BATCH_CHUNKS = Math.max(1, Math.floor(framesPerSec / 4));

  return new Promise((resolve) => {
    let batchStart = 0;

    function processBatch() {
      const batchEnd = Math.min(batchStart + BATCH_CHUNKS, chunkCount);
      for (let ci = batchStart; ci < batchEnd; ci++) {
        const start = Math.round((ci * sampleRate) / framesPerSec);
        const end = Math.min(Math.round(((ci + 1) * sampleRate) / framesPerSec), totalSamples);
        computeChunk(channelData, start, end, ci, sampleRate, peak, rms, centroid, scratch);
      }

      batchStart = batchEnd;
      if (batchStart < chunkCount) {
        setTimeout(processBatch, 0);
      } else {
        resolve({ peak, rms, centroid });
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
  sampleRate: number,
  peak: Float32Array,
  rms: Float32Array,
  centroid: Float32Array,
  scratch: FftScratch,
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
  centroid[ci] = count > 0 ? computeCentroid(channelData, start, end, sampleRate, scratch) : 0;
}

// --- Spectral centroid ---------------------------------------------------
//
// The centroid is the magnitude-weighted mean frequency of a chunk — a simple
// "brightness" measure. We map it onto a 0..1 scale on a log-frequency axis so
// the value is perceptually even (an octave is an octave) and independent of
// sample rate. 0 ≈ FREQ_MIN (deep/bass), 1 ≈ FREQ_MAX (bright/treble).

const FFT_SIZE = 512;
const FREQ_MIN = 80;
const FREQ_MAX = 16000;

interface FftScratch {
  re: Float32Array;
  im: Float32Array;
  window: Float32Array;
}

function createFftScratch(): FftScratch {
  const window = new Float32Array(FFT_SIZE);
  for (let i = 0; i < FFT_SIZE; i++) {
    // Hann window
    window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1)));
  }
  return {
    re: new Float32Array(FFT_SIZE),
    im: new Float32Array(FFT_SIZE),
    window,
  };
}

function computeCentroid(
  channelData: Float32Array[],
  start: number,
  end: number,
  sampleRate: number,
  scratch: FftScratch,
): number {
  const { re, im, window } = scratch;
  const totalSamples = channelData[0].length;
  const channels = channelData.length;

  // Center an FFT_SIZE window on the chunk so it represents the chunk's content
  // even when the chunk is shorter than the FFT window.
  const chunkLen = end - start;
  const windowStart = start - Math.floor((FFT_SIZE - chunkLen) / 2);

  for (let i = 0; i < FFT_SIZE; i++) {
    const si = windowStart + i;
    let s = 0;
    if (si >= 0 && si < totalSamples) {
      for (let ch = 0; ch < channels; ch++) s += channelData[ch][si];
      s /= channels;
    }
    re[i] = s * window[i];
    im[i] = 0;
  }

  fft(re, im);

  let num = 0;
  let den = 0;
  const half = FFT_SIZE / 2;
  const binHz = sampleRate / FFT_SIZE;
  for (let k = 1; k < half; k++) {
    const mag = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
    num += k * binHz * mag;
    den += mag;
  }
  if (den <= 0) return 0;

  const centroidHz = num / den;
  if (centroidHz <= 0) return 0;

  const fMax = Math.min(FREQ_MAX, sampleRate / 2);
  const t = (Math.log2(centroidHz) - Math.log2(FREQ_MIN)) / (Math.log2(fMax) - Math.log2(FREQ_MIN));
  return Math.max(0, Math.min(1, t));
}

// In-place iterative radix-2 Cooley–Tukey FFT. Length must be a power of two.
function fft(re: Float32Array, im: Float32Array): void {
  const n = re.length;

  // Bit-reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wlenRe = Math.cos(ang);
    const wlenIm = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let wRe = 1;
      let wIm = 0;
      for (let k = 0; k < half; k++) {
        const a = i + k;
        const b = a + half;
        const vRe = re[b] * wRe - im[b] * wIm;
        const vIm = re[b] * wIm + im[b] * wRe;
        re[b] = re[a] - vRe;
        im[b] = im[a] - vIm;
        re[a] += vRe;
        im[a] += vIm;
        const nwRe = wRe * wlenRe - wIm * wlenIm;
        wIm = wRe * wlenIm + wIm * wlenRe;
        wRe = nwRe;
      }
    }
  }
}
