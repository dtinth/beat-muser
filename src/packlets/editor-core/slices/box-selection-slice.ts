import { Slice } from "../slice";
import { SelectionSlice } from "./selection-slice";
import { ColumnsSlice } from "./columns-slice";
import { EVENT, BPM_CHANGE, TIME_SIGNATURE, NOTE, LEVEL_REF } from "../components";
import type { Entity } from "../../entity-manager";

export class BoxSelectionSlice extends Slice {
  static readonly sliceKey = "box-selection";

  private boxSelection = {
    active: false,
    startCol: 0,
    endCol: 0,
    startPulse: 0,
    endPulse: 0,
  };

  isActive(): boolean {
    return this.boxSelection.active;
  }

  start(colIndex: number, pulse: number): void {
    this.boxSelection = {
      active: true,
      startCol: colIndex,
      endCol: colIndex,
      startPulse: pulse,
      endPulse: pulse,
    };
  }

  update(colIndex: number, pulse: number): void {
    this.boxSelection.endCol = colIndex;
    this.boxSelection.endPulse = pulse;
  }

  isInBox(pulse: number, colIndex: number): boolean {
    const box = this.boxSelection;
    if (!box.active) return false;
    const minCol = Math.min(box.startCol, box.endCol);
    const maxCol = Math.max(box.startCol, box.endCol);
    const minPulse = Math.min(box.startPulse, box.endPulse);
    const maxPulse = Math.max(box.startPulse, box.endPulse);
    return pulse >= minPulse && pulse <= maxPulse && colIndex >= minCol && colIndex <= maxCol;
  }

  getBoxRect(): { minCol: number; maxCol: number; minPulse: number; maxPulse: number } | null {
    const box = this.boxSelection;
    if (!box.active) return null;
    return {
      minCol: Math.min(box.startCol, box.endCol),
      maxCol: Math.max(box.startCol, box.endCol),
      minPulse: Math.min(box.startPulse, box.endPulse),
      maxPulse: Math.max(box.startPulse, box.endPulse),
    };
  }

  finalize(entities: Entity[]): Set<string> {
    const box = this.boxSelection;
    if (!box.active) return new Set();

    const minCol = Math.min(box.startCol, box.endCol);
    const maxCol = Math.max(box.startCol, box.endCol);
    const minPulse = Math.min(box.startPulse, box.endPulse);
    const maxPulse = Math.max(box.startPulse, box.endPulse);

    const columns = this.ctx.get(ColumnsSlice).$columns.get();
    const next = new Set(this.ctx.get(SelectionSlice).$selection.get());

    for (const entity of entities) {
      const event = entity.components[EVENT.key];
      if (!event) continue;
      const pulse = event.y;
      if (pulse < minPulse || pulse > maxPulse) continue;

      let colIndex = -1;
      const note = entity.components[NOTE.key];
      const levelRef = entity.components[LEVEL_REF.key];
      if (note && levelRef) {
        for (let i = 0; i < columns.length; i++) {
          const col = columns[i]!;
          if (col.levelId === levelRef.levelId && col.laneIndex === note.lane) {
            colIndex = i;
            break;
          }
        }
      }
      if (colIndex === -1) {
        const bpm = entity.components[BPM_CHANGE.key];
        if (bpm) {
          for (let i = 0; i < columns.length; i++) {
            if (columns[i]!.id === "bpm") {
              colIndex = i;
              break;
            }
          }
        }
      }
      if (colIndex === -1) {
        const ts = entity.components[TIME_SIGNATURE.key];
        if (ts) {
          for (let i = 0; i < columns.length; i++) {
            if (columns[i]!.id === "time-sig") {
              colIndex = i;
              break;
            }
          }
        }
      }

      if (colIndex >= minCol && colIndex <= maxCol) {
        next.add(entity.id);
      }
    }

    this.ctx.get(SelectionSlice).$selection.set(next);
    this.boxSelection = { active: false, startCol: 0, endCol: 0, startPulse: 0, endPulse: 0 };
    return next;
  }
}
