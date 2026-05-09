import pLimit from "p-limit";
import { computeWaveformData } from "./compute-waveform-audio-buffer";
import type { AudioEngineDelegate, AudioEngineFileSystem } from "./types";

export interface CreateAudioEngineOptions {
  fileSystem: AudioEngineFileSystem;
  delegate: AudioEngineDelegate;
  maxConcurrentDecodes?: number;
}

export function createAudioEngine(options: CreateAudioEngineOptions) {
  const { fileSystem, delegate, maxConcurrentDecodes = 4 } = options;
  const audioContext = new AudioContext();
  const limit = pLimit(maxConcurrentDecodes);
  const controllers = new Map<string, AbortController>();
  let currentPaths = new Set<string>();

  async function loadFile(path: string): Promise<void> {
    const controller = new AbortController();
    controllers.set(path, controller);

    try {
      delegate.onWaveformStatus(path, "loading");

      const buffer = await fileSystem.readFile(path);
      if (controller.signal.aborted) return;

      const audioBuffer = await audioContext.decodeAudioData(buffer);
      if (controller.signal.aborted) return;

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
      }
    }

    for (const newPath of newPaths) {
      if (!currentPaths.has(newPath)) {
        limit(() => loadFile(newPath));
      }
    }

    currentPaths = newPaths;
  }

  function destroy(): void {
    for (const controller of controllers.values()) {
      controller.abort();
    }
    controllers.clear();
    audioContext.close();
  }

  return { setFilePaths, destroy };
}
