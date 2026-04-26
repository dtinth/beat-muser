import { atom } from "nanostores";
import { Slice } from "../slice";
import { HISTORY_LIMIT } from "../types";
import type { UserAction } from "../types";

export class HistorySlice extends Slice {
  static readonly sliceKey = "history";

  $history = atom<{ undo: UserAction[]; redo: UserAction[] }>({
    undo: [],
    redo: [],
  });

  applyAction(action: UserAction): void {
    action.do();
    const history = this.$history.get();
    const undo = [...history.undo, action];
    if (undo.length > HISTORY_LIMIT) {
      undo.shift();
    }
    this.$history.set({ undo, redo: [] });
  }

  undo(): void {
    const history = this.$history.get();
    const action = history.undo.pop();
    if (!action) return;
    action.undo();
    this.$history.set({
      undo: history.undo,
      redo: [...history.redo, action],
    });
  }

  redo(): void {
    const history = this.$history.get();
    const action = history.redo.pop();
    if (!action) return;
    action.do();
    this.$history.set({
      undo: [...history.undo, action],
      redo: history.redo,
    });
  }
}
