import { describe, expect, test } from "vite-plus/test";
import { computePeakAndRms } from "./compute-waveform.ts";

describe("computePeakAndRms", () => {
  test("silent audio produces all zeros", () => {
    const sampleRate = 48000;
    const data = new Float32Array(sampleRate); // 1 second of silence
    const result = computePeakAndRms([data], sampleRate, 120);

    expect(result.peak).toHaveLength(120);
    expect(result.rms).toHaveLength(120);
    for (let i = 0; i < 120; i++) {
      expect(result.peak[i]).toBe(0);
      expect(result.rms[i]).toBe(0);
    }
  });

  test("constant tone produces correct peak and RMS", () => {
    const sampleRate = 48000;
    const data = new Float32Array(sampleRate);
    data.fill(0.5);
    const result = computePeakAndRms([data], sampleRate, 120);

    expect(result.peak).toHaveLength(120);
    expect(result.rms).toHaveLength(120);
    for (let i = 0; i < 120; i++) {
      expect(result.peak[i]).toBeCloseTo(0.5, 5);
      expect(result.rms[i]).toBeCloseTo(0.5, 5);
    }
  });

  test("stereo uses max of both channels", () => {
    const sampleRate = 48000;
    const left = new Float32Array(sampleRate);
    left.fill(0.3);
    const right = new Float32Array(sampleRate);
    right.fill(0.8);
    const result = computePeakAndRms([left, right], sampleRate, 120);

    for (let i = 0; i < 120; i++) {
      expect(result.peak[i]).toBeCloseTo(0.8, 5);
    }
  });

  test("short audio produces fewer chunks", () => {
    const sampleRate = 48000;
    const data = new Float32Array(Math.floor(sampleRate * 0.25)); // 0.25 seconds
    const result = computePeakAndRms([data], sampleRate, 120);

    expect(result.peak).toHaveLength(30);
    expect(result.rms).toHaveLength(30);
  });

  test("varying amplitude per chunk", () => {
    const sampleRate = 48000;
    const chunkSize = Math.floor(sampleRate / 120); // 400 samples per chunk
    const data = new Float32Array(sampleRate);

    // First chunk: 0.2, second chunk: 0.8
    for (let i = 0; i < chunkSize; i++) {
      data[i] = 0.2;
      data[chunkSize + i] = 0.8;
    }

    const result = computePeakAndRms([data], sampleRate, 120);

    expect(result.peak[0]).toBeCloseTo(0.2, 5);
    expect(result.peak[1]).toBeCloseTo(0.8, 5);
  });
});
