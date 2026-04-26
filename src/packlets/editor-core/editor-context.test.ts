import { describe, expect, test } from "vite-plus/test";
import { EditorContext } from "./editor-context";
import { Slice } from "./slice";

class TestSlice extends Slice {
  static override readonly sliceKey = "test-slice";
  value = 42;
}

describe("EditorContext", () => {
  describe("register", () => {
    test("happy path: registers a slice by class constructor and returns it", () => {
      const ctx = new EditorContext();
      const slice = ctx.register(TestSlice);
      expect(slice).toBeInstanceOf(TestSlice);
      expect(slice.value).toBe(42);
    });

    test("happy path: registers a slice by factory function and returns it", () => {
      const ctx = new EditorContext();
      const slice = ctx.register(TestSlice, (c) => new TestSlice(c));
      expect(slice).toBeInstanceOf(TestSlice);
      expect(slice.value).toBe(42);
    });

    test("failed case: throws when sliceKey is 'unknown'", () => {
      const ctx = new EditorContext();
      class UnknownSlice extends Slice {
        // inherits static sliceKey = "unknown"
      }
      expect(() => ctx.register(UnknownSlice)).toThrow(
        'Slice class must define a static "sliceKey" property.',
      );
    });

    test("failed case: throws when registering a duplicate sliceKey", () => {
      const ctx = new EditorContext();
      ctx.register(TestSlice);
      expect(() => ctx.register(TestSlice)).toThrow('Slice "test-slice" is already registered.');
    });
  });

  describe("get", () => {
    test("happy path: retrieves a registered slice by class", () => {
      const ctx = new EditorContext();
      const registered = ctx.register(TestSlice);
      const retrieved = ctx.get(TestSlice);
      expect(retrieved).toBe(registered);
    });

    test("failed case: throws when getting a slice that is not registered", () => {
      const ctx = new EditorContext();
      expect(() => ctx.get(TestSlice)).toThrow('Slice "test-slice" is not registered.');
    });
  });
});
