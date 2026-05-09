import { describe, expect, test } from "vite-plus/test";
import { computeWaveformSegments } from "./waveform-segments";

describe("computeWaveformSegments", () => {
  function makeWaveformData(length = 120): { peak: Float32Array; rms: Float32Array } {
    const peak = new Float32Array(length);
    const rms = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      peak[i] = (i + 1) / length;
      rms[i] = peak[i] * 0.7;
    }
    return { peak, rms };
  }

  function linearFrameRange(
    startChunk: number,
    chunkCount: number,
  ): (
    renderingPos: number,
    pixelLength: number,
  ) => { startFrame: number; endFrame: number } | null {
    return (renderingPos: number, pixelLength: number) => {
      const fs = startChunk + Math.floor((renderingPos * chunkCount) / pixelLength);
      const fe = startChunk + Math.ceil(((renderingPos + 1) * chunkCount) / pixelLength);
      return { startFrame: fs, endFrame: fe };
    };
  }

  function getPixels(segment: ReturnType<typeof computeWaveformSegments>[0]) {
    return segment.getWaveformPixels();
  }

  test("1:1 mapping — one frame per pixel, single segment", () => {
    const { peak, rms } = makeWaveformData(120);
    const segments = computeWaveformSegments(peak, rms, {
      pixelLength: 120,
      maxSegmentPixels: 512,
      getFrameRange: linearFrameRange(0, 120),
    });

    expect(segments).toHaveLength(1);
    expect(segments[0].pixelStart).toBe(0);
    expect(segments[0].pixelLength).toBe(120);

    const pixels = getPixels(segments[0]);
    expect(pixels.peak.length).toBe(120);
    expect(pixels.rms.length).toBe(120);
    // renderingPos 0 = first frame
    expect(pixels.peak[0]).toBeCloseTo(1 / 120, 5);
    expect(pixels.rms[0]).toBeCloseTo(0.7 / 120, 5);
    // renderingPos 119 = last frame
    expect(pixels.peak[119]).toBeCloseTo(120 / 120, 5);
    expect(pixels.rms[119]).toBeCloseTo((0.7 * 120) / 120, 5);
  });

  test("downsampling — 2 frames per pixel", () => {
    const { peak, rms } = makeWaveformData(240);
    const segments = computeWaveformSegments(peak, rms, {
      pixelLength: 120,
      maxSegmentPixels: 512,
      getFrameRange: linearFrameRange(0, 240),
    });

    expect(segments).toHaveLength(1);

    const pixels = getPixels(segments[0]);
    expect(pixels.peak.length).toBe(120);
    expect(pixels.rms.length).toBe(120);
    // renderingPos 0 = frames 0-1 = max(1/240, 2/240) = 2/240
    expect(pixels.peak[0]).toBeCloseTo(2 / 240, 5);
    // renderingPos 119 = frames 238-239 = max(239/240, 240/240) = 1
    expect(pixels.peak[119]).toBeCloseTo(240 / 240, 5);
  });

  test("upsampling — 1 frame per 2 pixels", () => {
    const { peak, rms } = makeWaveformData(60);
    const segments = computeWaveformSegments(peak, rms, {
      pixelLength: 120,
      maxSegmentPixels: 512,
      getFrameRange: linearFrameRange(0, 60),
    });

    expect(segments).toHaveLength(1);

    const pixels = getPixels(segments[0]);
    expect(pixels.peak.length).toBe(120);
    // renderingPos 0 = frame 0 → 1/60
    expect(pixels.peak[0]).toBeCloseTo(1 / 60, 5);
    // renderingPos 119 = frame 59 → 60/60 = 1
    expect(pixels.peak[119]).toBeCloseTo(60 / 60, 5);
  });

  test("partitioning — splits into max 512px segments", () => {
    const { peak, rms } = makeWaveformData(1500);
    const segments = computeWaveformSegments(peak, rms, {
      pixelLength: 1500,
      maxSegmentPixels: 512,
      getFrameRange: linearFrameRange(0, 1500),
    });

    expect(segments).toHaveLength(3);
    expect(segments[0].pixelStart).toBe(0);
    expect(segments[0].pixelLength).toBe(512);
    expect(segments[1].pixelStart).toBe(512);
    expect(segments[1].pixelLength).toBe(512);
    expect(segments[2].pixelStart).toBe(1024);
    expect(segments[2].pixelLength).toBe(476);

    // Each segment's getWaveformPixels returns correct dimensions
    expect(getPixels(segments[0]).peak.length).toBe(512);
    expect(getPixels(segments[1]).peak.length).toBe(512);
    expect(getPixels(segments[2]).peak.length).toBe(476);
  });

  test("non-zero startChunk", () => {
    const { peak, rms } = makeWaveformData(120);
    const segments = computeWaveformSegments(peak, rms, {
      pixelLength: 30,
      maxSegmentPixels: 512,
      getFrameRange: linearFrameRange(60, 30),
    });

    expect(segments).toHaveLength(1);

    const pixels = getPixels(segments[0]);
    // renderingPos 0 = frame 60 → 61/120
    expect(pixels.peak[0]).toBeCloseTo(61 / 120, 5);
    // renderingPos 29 = frame 89 → 90/120
    expect(pixels.peak[29]).toBeCloseTo(90 / 120, 5);
  });
});
