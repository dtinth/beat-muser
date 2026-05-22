import pLimit from "p-limit";
import { computeWaveformData } from "./compute-waveform-audio-buffer.ts";
import type { AudioEngineDelegate, AudioEngineFileSystem } from "./types.ts";

export interface CreateAudioEngineOptions {
  fileSystem: AudioEngineFileSystem;
  delegate: AudioEngineDelegate;
  maxConcurrentDecodes?: number;
}

export function createAudioEngine(options: CreateAudioEngineOptions) {
  const { fileSystem, delegate, maxConcurrentDecodes = 4 } = options;
  const audioContext = new AudioContext();
  const masterGain = audioContext.createGain();
  masterGain.connect(audioContext.destination);
  masterGain.gain.value = 0.8;
  const limit = pLimit(maxConcurrentDecodes);
  const controllers = new Map<string, AbortController>();
  let currentPaths = new Set<string>();
  const buffers = new Map<string, AudioBuffer>();
  const channelGains = new Map<string, GainNode>();

  function getOrCreateChannelGain(path: string): GainNode {
    let gain = channelGains.get(path);
    if (!gain) {
      gain = audioContext.createGain();
      gain.connect(masterGain);
      gain.gain.value = 1;
      channelGains.set(path, gain);
    }
    return gain;
  }

  async function loadFile(path: string): Promise<void> {
    const controller = new AbortController();
    controllers.set(path, controller);

    try {
      delegate.onWaveformStatus(path, "loading");

      const buffer = await fileSystem.readFile(path);
      if (controller.signal.aborted) return;

      const audioBuffer = await audioContext.decodeAudioData(buffer);
      if (controller.signal.aborted) return;

      buffers.set(path, audioBuffer);

      delegate.onWaveformStatus(path, "generating");

      const data = await computeWaveformData(audioBuffer);
      if (controller.signal.aborted) return;

      delegate.onWaveformStatus(path, "ready");
      delegate.onWaveformReady(path, data);
    } catch (e) {
      if (controller.signal.aborted) return;
      delegate.onWaveformStatus(path, "decoding-failed");
      delegate.onWaveformError(path, e instanceof Error ? e : new Error(String(e)));
    }
  }

  function setFilePaths(paths: string[]): void {
    const newPaths = new Set(paths);

    for (const oldPath of currentPaths) {
      if (!newPaths.has(oldPath)) {
        const controller = controllers.get(oldPath);
        if (controller) {
          controller.abort();
          controllers.delete(oldPath);
        }
        buffers.delete(oldPath);
        const gain = channelGains.get(oldPath);
        if (gain) {
          gain.disconnect();
          channelGains.delete(oldPath);
        }
      }
    }

    for (const newPath of newPaths) {
      if (!currentPaths.has(newPath)) {
        void limit(() => loadFile(newPath));
      }
    }

    currentPaths = newPaths;
  }

  function destroy(): void {
    for (const controller of controllers.values()) {
      controller.abort();
    }
    controllers.clear();
    buffers.clear();
    for (const gain of channelGains.values()) {
      gain.disconnect();
    }
    channelGains.clear();
    masterGain.disconnect();
    void audioContext.close();
  }

  return {
    setFilePaths,
    destroy,
    audioContext,
    masterGain,
    getOrCreateChannelGain,
    getBuffer: (path: string) => buffers.get(path),
    buffers,
    channelGains,
  };
}
