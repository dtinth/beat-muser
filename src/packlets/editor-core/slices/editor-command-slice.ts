import { Slice } from "../slice";
import type { EditorContext } from "../editor-context";
import { SelectionSlice } from "./selection-slice";
import { ProjectSlice } from "./project-slice";
import { HistorySlice } from "./history-slice";
import type { Entity } from "../../entity-manager";
import { DeleteUserAction } from "../user-actions";

export class EditorCommandSlice extends Slice {
  static readonly sliceKey = "editorCommand";

  constructor(ctx: EditorContext) {
    super(ctx);
  }

  deleteSelection(): void {
    const selection = this.ctx.get(SelectionSlice).$selection.get();
    if (selection.size === 0) return;

    const entityManager = this.ctx.get(ProjectSlice).entityManager;
    const entityIds = Array.from(selection);
    const entities = entityIds
      .map((id) => entityManager.get(id))
      .filter((e): e is Entity => e !== undefined)
      .map((e) => structuredClone(e));

    this.ctx.get(HistorySlice).applyAction(new DeleteUserAction(this.ctx, entityIds, entities));
  }
}
