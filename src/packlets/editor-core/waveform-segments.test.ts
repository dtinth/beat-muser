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

  test("1:1 mapping — one chunk per pixel, single segment", () => {
    const { peak, rms } = makeWaveformData(120);
    const segments = computeWaveformSegments(peak, rms, {
      startChunk: 0,
      chunkCount: 120,
      pixelHeight: 120,
      maxSegmentPixels: 512,
    });

    expect(segments).toHaveLength(1);
    expect(segments[0].pixelStart).toBe(0);
    expect(segments[0].pixelHeight).toBe(120);
    expect(segments[0].peak.length).toBe(120);
    expect(segments[0].rms.length).toBe(120);
    expect(segments[0].peak[0]).toBeCloseTo(1 / 120, 5);
    expect(segments[0].rms[0]).toBeCloseTo(0.7 / 120, 5);
  });

  test("downsampling — 2 chunks per pixel", () => {
    const { peak, rms } = makeWaveformData(240);
    const segments = computeWaveformSegments(peak, rms, {
      startChunk: 0,
      chunkCount: 240,
      pixelHeight: 120,
      maxSegmentPixels: 512,
    });

    expect(segments).toHaveLength(1);
    expect(segments[0].peak.length).toBe(120);
    expect(segments[0].rms.length).toBe(120);
    expect(segments[0].peak[0]).toBeCloseTo(2 / 240, 5);
    expect(segments[0].rms[0]).toBeCloseTo(0.7 * (1.5 / 240), 5);
  });

  test("upsampling — 1 chunk per 2 pixels", () => {
    const { peak, rms } = makeWaveformData(60);
    const segments = computeWaveformSegments(peak, rms, {
      startChunk: 0,
      chunkCount: 60,
      pixelHeight: 120,
      maxSegmentPixels: 512,
    });

    expect(segments).toHaveLength(1);
    expect(segments[0].peak.length).toBe(120);
    expect(segments[0].peak[0]).toBeCloseTo(1 / 60, 5);
    expect(segments[0].peak[1]).toBeCloseTo(1 / 60, 5);
  });

  test("partitioning — splits into max 512px segments", () => {
    const { peak, rms } = makeWaveformData(1500);
    const segments = computeWaveformSegments(peak, rms, {
      startChunk: 0,
      chunkCount: 1500,
      pixelHeight: 1500,
      maxSegmentPixels: 512,
    });

    expect(segments).toHaveLength(3);
    expect(segments[0].pixelStart).toBe(0);
    expect(segments[0].pixelHeight).toBe(512);
    expect(segments[1].pixelStart).toBe(512);
    expect(segments[1].pixelHeight).toBe(512);
    expect(segments[2].pixelStart).toBe(1024);
    expect(segments[2].pixelHeight).toBe(476);
  });

  test("non-zero startChunk", () => {
    const { peak, rms } = makeWaveformData(120);
    const segments = computeWaveformSegments(peak, rms, {
      startChunk: 60,
      chunkCount: 30,
      pixelHeight: 30,
      maxSegmentPixels: 512,
    });

    expect(segments).toHaveLength(1);
    expect(segments[0].peak[0]).toBeCloseTo(61 / 120, 5);
    expect(segments[0].peak[29]).toBeCloseTo(90 / 120, 5);
  });
});
