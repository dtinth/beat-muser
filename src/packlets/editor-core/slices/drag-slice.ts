import { Slice } from "../slice";

export class DragSlice extends Slice {
  static readonly sliceKey = "drag";

  private state = {
    mode: "idle" as "idle" | "pending" | "dragging",
    startViewportX: 0,
    startViewportY: 0,
    originalPulses: new Map<string, number>(),
    originalColumnIndices: new Map<string, number>(),
    startPulse: 0,
    startColumnIndex: 0,
    deltaPulse: 0,
    deltaColumnIndex: 0,
    affinity: null as "gameplay" | "sound" | null,
  };

  startDrag(
    startViewportY: number,
    _entityIds: string[],
    originalPulses: Map<string, number>,
    startPulse: number,
    startViewportX?: number,
    originalColumnIndices?: Map<string, number>,
    startColumnIndex?: number,
    affinity?: "gameplay" | "sound" | null,
  ): void {
    this.state = {
      mode: "pending",
      startViewportX: startViewportX ?? 0,
      startViewportY,
      originalPulses: new Map(originalPulses),
      originalColumnIndices: new Map(originalColumnIndices ?? []),
      startPulse,
      startColumnIndex: startColumnIndex ?? 0,
      deltaPulse: 0,
      deltaColumnIndex: 0,
      affinity: affinity ?? null,
    };
  }

  updateDrag(
    currentViewportY: number,
    currentPulse: number,
    currentViewportX?: number,
    currentColumnIndex?: number,
    maxColumnIndex?: number,
  ): void {
    if (this.state.mode === "idle") return;

    const dx = currentViewportX !== undefined ? currentViewportX - this.state.startViewportX : 0;
    const dy = currentViewportY - this.state.startViewportY;
    const distance = Math.sqrt(dx * dx + dy * dy);
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

      if (this.state.affinity && currentColumnIndex !== undefined) {
        const rawColumnDelta = currentColumnIndex - this.state.startColumnIndex;
        let minOriginalColumnIndex = Infinity;
        let maxOriginalColumnIndex = -Infinity;
        for (const index of this.state.originalColumnIndices.values()) {
          minOriginalColumnIndex = Math.min(minOriginalColumnIndex, index);
          maxOriginalColumnIndex = Math.max(maxOriginalColumnIndex, index);
        }
        if (maxColumnIndex !== undefined) {
          this.state.deltaColumnIndex = rawColumnDelta;
          this.state.deltaColumnIndex = Math.max(
            -minOriginalColumnIndex,
            this.state.deltaColumnIndex,
          );
          this.state.deltaColumnIndex = Math.min(
            maxColumnIndex - maxOriginalColumnIndex,
            this.state.deltaColumnIndex,
          );
        } else {
          this.state.deltaColumnIndex = rawColumnDelta;
        }
      }
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

  getDeltaColumnIndex(): number {
    return this.state.deltaColumnIndex;
  }

  getOriginalPulses(): Map<string, number> {
    return this.state.originalPulses;
  }

  getOriginalColumnIndices(): Map<string, number> {
    return this.state.originalColumnIndices;
  }

  getAffinity(): "gameplay" | "sound" | null {
    return this.state.affinity;
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
      startViewportX: 0,
      startViewportY: 0,
      originalPulses: new Map(),
      originalColumnIndices: new Map(),
      startPulse: 0,
      startColumnIndex: 0,
      deltaPulse: 0,
      deltaColumnIndex: 0,
      affinity: null,
    };
  }
}
