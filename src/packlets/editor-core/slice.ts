import type { EditorContext } from "./editor-context";

export class Slice {
  static readonly sliceKey: string = "unknown";
  static readonly layer: number = 0;

  protected ctx: EditorContext;

  constructor(ctx: EditorContext) {
    this.ctx = ctx;
  }
}

export interface SliceConstructor<T extends Slice = Slice> {
  sliceKey: string;
  layer: number;
  new (ctx: EditorContext): T;
}
