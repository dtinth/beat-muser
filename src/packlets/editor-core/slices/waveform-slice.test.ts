import { describe, expect, test } from "vite-plus/test";
import { EditorContext } from "../editor-context";
import { WaveformSlice, type WaveformData } from "./waveform-slice";

describe("WaveformSlice", () => {
  test("setWaveformData stores data by path", () => {
    const ctx = new EditorContext();
    const slice = ctx.register(WaveformSlice);

    const data: WaveformData = {
      peak: new Float32Array([0.5, 0.8]),
      rms: new Float32Array([0.3, 0.6]),
      durationSec: 2.5,
      sampleRate: 48000,
    };

    slice.setWaveformData("audio/kick.wav", data);
    expect(slice.$waveformData.get()).toBeInstanceOf(Map);
    expect(slice.$waveformData.get().get("audio/kick.wav")).toBe(data);
  });

  test("setWaveformStatus tracks status per path", () => {
    const ctx = new EditorContext();
    const slice = ctx.register(WaveformSlice);

    slice.setWaveformStatus("audio/kick.wav", "loading");
    expect(slice.$waveformStatus.get().get("audio/kick.wav")).toBe("loading");

    slice.setWaveformStatus("audio/kick.wav", "ready");
    expect(slice.$waveformStatus.get().get("audio/kick.wav")).toBe("ready");
  });

  test("removeWaveformData removes data and status", () => {
    const ctx = new EditorContext();
    const slice = ctx.register(WaveformSlice);

    const data: WaveformData = {
      peak: new Float32Array([0.5]),
      rms: new Float32Array([0.3]),
      durationSec: 1,
      sampleRate: 44100,
    };

    slice.setWaveformData("audio/snare.wav", data);
    slice.setWaveformStatus("audio/snare.wav", "ready");
    slice.removeWaveformData("audio/snare.wav");

    expect(slice.$waveformData.get().has("audio/snare.wav")).toBe(false);
    expect(slice.$waveformStatus.get().has("audio/snare.wav")).toBe(false);
  });

  test("default status for unknown path is nothing", () => {
    const ctx = new EditorContext();
    const slice = ctx.register(WaveformSlice);

    expect(slice.$waveformStatus.get().get("unknown.wav")).toBeUndefined();
    expect(slice.$waveformData.get().get("unknown.wav")).toBeUndefined();
  });
});
