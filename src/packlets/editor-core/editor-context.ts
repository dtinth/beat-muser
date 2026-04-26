import type { Slice } from "./slice";

export class EditorContext {
  private slices = new Map<string, Slice>();

  register<T extends Slice>(SliceClass: { sliceKey: string; new (ctx: EditorContext): T }): T;
  register<T extends Slice>(
    SliceClass: { sliceKey: string },
    factory: (ctx: EditorContext) => T,
  ): T;
  register<T extends Slice>(
    SliceClass: { sliceKey: string; new (ctx: EditorContext): T },
    factory?: (ctx: EditorContext) => T,
  ): T {
    const key = SliceClass.sliceKey;
    if (key === "unknown") {
      throw new Error(
        `Slice class must define a static "sliceKey" property. ` +
          `Example: static readonly sliceKey = "my-slice";`,
      );
    }
    if (this.slices.has(key)) {
      throw new Error(
        `Slice "${key}" is already registered. ` +
          `Available slices: ${[...this.slices.keys()].join(", ")}`,
      );
    }
    const slice = factory ? factory(this) : new SliceClass(this);
    this.slices.set(key, slice);
    return slice;
  }

  get<T extends Slice>(SliceClass: { sliceKey: string; new (...args: never[]): T }): T {
    const key = SliceClass.sliceKey;
    const slice = this.slices.get(key);
    if (!slice) {
      throw new Error(
        `Slice "${key}" is not registered. ` +
          `Available slices: ${[...this.slices.keys()].join(", ")}`,
      );
    }
    return slice as T;
  }
}
