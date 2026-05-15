import { Slice } from "../slice";

export interface StartDragParams {
  viewportY: number;
  entityIds: string[];
  originalPulses: Map<string, number>;
  startPulse: number;
  viewportX?: number;
  originalColumnIndices?: Map<string, number>;
  startColumnIndex?: number;
}

export interface UpdateDragParams {
  viewportY: number;
  pulse: number;
  viewportX?: number;
  columnIndex?: number;
  maxColumnIndex?: number;
}

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
  };

  startDrag(params: StartDragParams): void {
    this.state = {
      mode: "pending",
      startViewportX: params.viewportX ?? 0,
      startViewportY: params.viewportY,
      originalPulses: new Map(params.originalPulses),
      originalColumnIndices: new Map(params.originalColumnIndices ?? []),
      startPulse: params.startPulse,
      startColumnIndex: params.startColumnIndex ?? 0,
      deltaPulse: 0,
      deltaColumnIndex: 0,
    };
  }

  updateDrag(params: UpdateDragParams): void {
    if (this.state.mode === "idle") return;

    const dx = params.viewportX !== undefined ? params.viewportX - this.state.startViewportX : 0;
    const dy = params.viewportY - this.state.startViewportY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (this.state.mode === "pending" && distance >= 5) {
      this.state.mode = "dragging";
    }

    if (this.state.mode === "dragging") {
      const rawDelta = params.pulse - this.state.startPulse;
      let minOriginalPulse = Infinity;
      for (const pulse of this.state.originalPulses.values()) {
        minOriginalPulse = Math.min(minOriginalPulse, pulse);
      }
      this.state.deltaPulse = Math.max(-minOriginalPulse, rawDelta);

      if (this.state.originalColumnIndices.size > 0 && params.columnIndex !== undefined) {
        const rawColumnDelta = params.columnIndex - this.state.startColumnIndex;
        let minOriginalColumnIndex = Infinity;
        let maxOriginalColumnIndex = -Infinity;
        for (const index of this.state.originalColumnIndices.values()) {
          minOriginalColumnIndex = Math.min(minOriginalColumnIndex, index);
          maxOriginalColumnIndex = Math.max(maxOriginalColumnIndex, index);
        }
        if (params.maxColumnIndex !== undefined) {
          this.state.deltaColumnIndex = rawColumnDelta;
          this.state.deltaColumnIndex = Math.max(
            -minOriginalColumnIndex,
            this.state.deltaColumnIndex,
          );
          this.state.deltaColumnIndex = Math.min(
            params.maxColumnIndex - maxOriginalColumnIndex,
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
    };
  }
}
