import { atom } from "nanostores";
import { createNanoEvents } from "nanoevents";
import { Slice } from "../slice.ts";
import type { Playback } from "../../playback-contract/index.ts";

export type TransportState = "stopped" | "playing" | "paused";

export class PlaybackSlice extends Slice {
  static readonly sliceKey = "playback";

  $transportState = atom<TransportState>("stopped");
  $playbackPulse = atom<number>(0);

  private prePlaybackCursorPulse = 0;
  private prePlaybackScrollY = 0;
  private chartEndPulse = Infinity;
  private activeAbortController: AbortController | null = null;

  private events = createNanoEvents<{
    playRequest: (playback: Playback) => void;
    stopRequest: (scrollY: number) => void;
  }>();

  onPlayRequest(cb: (playback: Playback) => void): () => void {
    return this.events.on("playRequest", cb);
  }

  onStopRequest(cb: (scrollY: number) => void): () => void {
    return this.events.on("stopRequest", cb);
  }

  onStateChanged(cb: () => void): () => void {
    return this.$transportState.listen(cb);
  }

  newAbortController(): AbortController {
    this.abort();
    const controller = new AbortController();
    this.activeAbortController = controller;
    return controller;
  }

  abort(): void {
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
    }
  }

  play(playback: Playback, cursorPulse: number, scrollY: number): void {
    this.prePlaybackCursorPulse = cursorPulse;
    this.prePlaybackScrollY = scrollY;
    this.$playbackPulse.set(cursorPulse);
    this.$transportState.set("playing");
    this.events.emit("playRequest", playback);
  }

  pause(): void {
    if (this.$transportState.get() !== "playing") return;
    this.$transportState.set("paused");
    this.abort();
  }

  stop(): void {
    if (this.$transportState.get() === "stopped") return;
    this.$transportState.set("stopped");
    this.abort();
    this.$playbackPulse.set(this.prePlaybackCursorPulse);
    this.events.emit("stopRequest", this.prePlaybackScrollY);
  }

  setPlaybackPulse(pulse: number): void {
    this.$playbackPulse.set(pulse);
  }

  setChartEndPulse(pulse: number): void {
    this.chartEndPulse = pulse;
  }

  getChartEndPulse(): number {
    return this.chartEndPulse;
  }
}
