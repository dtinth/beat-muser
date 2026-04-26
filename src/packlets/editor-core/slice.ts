import type { EditorContext } from "./editor-context";

export class Slice {
  static readonly sliceKey: string = "unknown";

  protected ctx: EditorContext;

  constructor(ctx: EditorContext) {
    this.ctx = ctx;
  }
}
