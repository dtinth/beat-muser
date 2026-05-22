import { Slice } from "../slice.ts";
import type { EditorContext } from "../editor-context.ts";
import { SelectionSlice } from "./selection-slice.ts";
import { ProjectSlice } from "./project-slice.ts";
import { HistorySlice } from "./history-slice.ts";
import type { Entity } from "../../entity-manager/index.ts";
import { DeleteUserAction } from "../user-actions.ts";

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
