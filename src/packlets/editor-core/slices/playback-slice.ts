import { atom } from "nanostores";
import { createNanoEvents } from "nanoevents";
import { Slice } from "../slice";
import type { Playback } from "../../playback-contract";

export type TransportState = "stopped" | "playing" | "paused";

export class PlaybackSlice extends Slice {
  static readonly sliceKey = "playback";

  $transportState = atom<TransportState>("stopped");
  $playbackPulse = atom<number>(0);

  private prePlaybackCursor = 0;
  private prePlaybackScrollY = 0;
  private chartEndPulse = Infinity;

  private events = createNanoEvents<{
    playRequest: (playback: Playback) => void;
    stopRequest: (scrollY: number) => void;
    pauseRequest: () => void;
  }>();

  onPlayRequest(cb: (playback: Playback) => void): () => void {
    return this.events.on("playRequest", cb);
  }

  onStopRequest(cb: (scrollY: number) => void): () => void {
    return this.events.on("stopRequest", cb);
  }

  onPauseRequest(cb: () => void): () => void {
    return this.events.on("pauseRequest", cb);
  }

  onStateChanged(cb: () => void): () => void {
    return this.$transportState.listen(cb);
  }

  play(playback: Playback, cursorPulse: number, scrollY: number): void {
    this.prePlaybackCursor = cursorPulse;
    this.prePlaybackScrollY = scrollY;
    this.$playbackPulse.set(cursorPulse);
    this.$transportState.set("playing");
    this.events.emit("playRequest", playback);
  }

  pause(): void {
    if (this.$transportState.get() !== "playing") return;
    this.$transportState.set("paused");
    this.events.emit("pauseRequest");
  }

  stop(): void {
    if (this.$transportState.get() === "stopped") return;
    this.$transportState.set("stopped");
    this.$playbackPulse.set(this.prePlaybackCursor);
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
