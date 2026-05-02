import { Slice } from "../slice";

export class DragSlice extends Slice {
  static readonly sliceKey = "drag";

  private state = {
    mode: "idle" as "idle" | "pending" | "dragging",
    startViewportY: 0,
    originalPulses: new Map<string, number>(),
    startPulse: 0,
    deltaPulse: 0,
  };

  startDrag(
    startViewportY: number,
    _entityIds: string[],
    originalPulses: Map<string, number>,
    startPulse: number,
  ): void {
    this.state = {
      mode: "pending",
      startViewportY,
      originalPulses: new Map(originalPulses),
      startPulse,
      deltaPulse: 0,
    };
  }

  updateDrag(currentViewportY: number, currentPulse: number): void {
    if (this.state.mode === "idle") return;

    const distance = Math.abs(currentViewportY - this.state.startViewportY);
    if (this.state.mode === "pending" && distance >= 5) {
      this.state.mode = "dragging";
    }

    if (this.state.mode === "dragging") {
      const rawDelta = currentPulse - this.state.startPulse;
      let minOriginalPulse = Infinity;
      for (const pulse of this.state.originalPulses.values()) {
        minOriginalPulse = Math.min(minOriginalPulse, pulse);
      }
      this.state.deltaPulse = Math.max(-minOriginalPulse, rawDelta);
    }
  }

  isDragging(): boolean {
    return this.state.mode === "dragging";
  }

  isPending(): boolean {
    return this.state.mode === "pending";
  }

  isActive(): boolean {
    return this.state.mode === "pending" || this.state.mode === "dragging";
  }

  getDeltaPulse(): number {
    return this.state.deltaPulse;
  }

  getOriginalPulses(): Map<string, number> {
    return this.state.originalPulses;
  }

  endDrag(): number | null {
    if (this.state.mode !== "dragging") {
      this.reset();
      return null;
    }
    const delta = this.state.deltaPulse;
    this.reset();
    return delta;
  }

  cancelDrag(): void {
    this.reset();
  }

  private reset(): void {
    this.state = {
      mode: "idle",
      startViewportY: 0,
      originalPulses: new Map(),
      startPulse: 0,
      deltaPulse: 0,
    };
  }
}
