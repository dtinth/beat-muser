/**
 * @packageDocumentation
 *
 * Unit tests for `RenderObjectReconciler` — the handle lifecycle engine.
 */

import { describe, expect, test, vi } from "vite-plus/test";
import { RenderObjectReconciler } from "./reconciler.ts";
import { positionElement } from "./index.tsx";
import type { RenderHandle, RenderObject } from "./index.tsx";

function makeRenderer() {
  return vi.fn(
    (_data: unknown): RenderHandle => ({
      dom: { tagName: "div" } as unknown as HTMLElement,
      update: vi.fn(),
      [Symbol.dispose]: vi.fn(),
    }),
  );
}

function makeObject(
  key: string,
  renderer: ReturnType<typeof makeRenderer>,
  overrides?: Partial<RenderObject>,
): RenderObject {
  return {
    key,
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    renderer,
    data: { key },
    ...overrides,
  };
}

describe("RenderObjectReconciler", () => {
  test("creates handles for all new keys on first reconcile", () => {
    const renderer = makeRenderer();
    const onAdd = vi.fn();
    const onUpdate = vi.fn();
    const onRemove = vi.fn();
    const reconciler = new RenderObjectReconciler({ onAdd, onUpdate, onRemove });

    reconciler.reconcile([
      makeObject("A", renderer),
      makeObject("B", renderer),
      makeObject("C", renderer),
    ]);

    expect(renderer).toHaveBeenCalledTimes(3);
    expect(onAdd).toHaveBeenCalledTimes(3);
    expect(onUpdate).toHaveBeenCalledTimes(0);
    expect(onRemove).toHaveBeenCalledTimes(0);

    const addedKeys = onAdd.mock.calls.map((call) => call[0]);
    expect(addedKeys).toContain("A");
    expect(addedKeys).toContain("B");
    expect(addedKeys).toContain("C");
  });

  test("reuses existing handles and calls update on subsequent reconciles", () => {
    const renderer = makeRenderer();
    const onAdd = vi.fn();
    const onUpdate = vi.fn();
    const onRemove = vi.fn();
    const reconciler = new RenderObjectReconciler({ onAdd, onUpdate, onRemove });

    reconciler.reconcile([makeObject("A", renderer), makeObject("B", renderer)]);
    expect(renderer).toHaveBeenCalledTimes(2);

    reconciler.reconcile([makeObject("A", renderer), makeObject("B", renderer)]);

    expect(renderer).toHaveBeenCalledTimes(2); // No new renders
    expect(onAdd).toHaveBeenCalledTimes(2);
    expect(onUpdate).toHaveBeenCalledTimes(2);
    expect(onRemove).toHaveBeenCalledTimes(0);

    // Verify update was called on the same handles
    const handleA = onAdd.mock.calls.find((call) => call[0] === "A")![1] as RenderHandle;
    const updatedA = onUpdate.mock.calls.find((call) => call[1] === handleA);
    expect(updatedA).toBeDefined();
  });

  test("disposes and removes stale keys", () => {
    const renderer = makeRenderer();
    const onAdd = vi.fn();
    const onUpdate = vi.fn();
    const onRemove = vi.fn();
    const reconciler = new RenderObjectReconciler({ onAdd, onUpdate, onRemove });

    reconciler.reconcile([makeObject("A", renderer), makeObject("B", renderer)]);
    const handleB = onAdd.mock.calls.find((call) => call[0] === "B")![1] as RenderHandle;

    reconciler.reconcile([makeObject("A", renderer)]);

    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledWith("B", handleB);
    expect(handleB[Symbol.dispose]).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledTimes(1); // A updated
    expect(onAdd).toHaveBeenCalledTimes(2); // No new additions
  });

  test("adds new keys while keeping existing ones", () => {
    const renderer = makeRenderer();
    const onAdd = vi.fn();
    const onUpdate = vi.fn();
    const onRemove = vi.fn();
    const reconciler = new RenderObjectReconciler({ onAdd, onUpdate, onRemove });

    reconciler.reconcile([makeObject("A", renderer)]);
    reconciler.reconcile([makeObject("A", renderer), makeObject("B", renderer)]);

    expect(onAdd).toHaveBeenCalledTimes(2);
    expect(onUpdate).toHaveBeenCalledTimes(1); // A
    expect(onRemove).toHaveBeenCalledTimes(0);
  });

  test("disposeAll removes and disposes every handle", () => {
    const renderer = makeRenderer();
    const onAdd = vi.fn();
    const onUpdate = vi.fn();
    const onRemove = vi.fn();
    const reconciler = new RenderObjectReconciler({ onAdd, onUpdate, onRemove });

    reconciler.reconcile([makeObject("A", renderer), makeObject("B", renderer)]);
    const handleA = onAdd.mock.calls.find((call) => call[0] === "A")![1] as RenderHandle;
    const handleB = onAdd.mock.calls.find((call) => call[0] === "B")![1] as RenderHandle;

    reconciler.disposeAll();

    expect(onRemove).toHaveBeenCalledTimes(2);
    expect(handleA[Symbol.dispose]).toHaveBeenCalledTimes(1);
    expect(handleB[Symbol.dispose]).toHaveBeenCalledTimes(1);
  });

  test("handles empty reconcile after populating", () => {
    const renderer = makeRenderer();
    const onAdd = vi.fn();
    const onUpdate = vi.fn();
    const onRemove = vi.fn();
    const reconciler = new RenderObjectReconciler({ onAdd, onUpdate, onRemove });

    reconciler.reconcile([makeObject("A", renderer)]);
    reconciler.reconcile([]);

    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledWith("A", expect.any(Object));
  });

  test("does not call dispose twice for handles removed then disposed via disposeAll", () => {
    const renderer = makeRenderer();
    const onAdd = vi.fn();
    const onUpdate = vi.fn();
    const onRemove = vi.fn();
    const reconciler = new RenderObjectReconciler({ onAdd, onUpdate, onRemove });

    reconciler.reconcile([makeObject("A", renderer)]);
    const handleA = onAdd.mock.calls.find((call) => call[0] === "A")![1] as RenderHandle;

    reconciler.reconcile([]); // A removed
    expect(handleA[Symbol.dispose]).toHaveBeenCalledTimes(1);

    reconciler.disposeAll(); // Map is already empty
    expect(handleA[Symbol.dispose]).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  test("calls update with latest data", () => {
    const renderer = makeRenderer();
    const onAdd = vi.fn();
    const onUpdate = vi.fn();
    const onRemove = vi.fn();
    const reconciler = new RenderObjectReconciler({ onAdd, onUpdate, onRemove });

    reconciler.reconcile([makeObject("A", renderer, { data: { version: 1 } })]);
    const handleA = onAdd.mock.calls.find((call) => call[0] === "A")![1] as RenderHandle;

    reconciler.reconcile([makeObject("A", renderer, { data: { version: 2 } })]);

    const updatedA = onUpdate.mock.calls.find((call) => call[1] === handleA);
    expect(updatedA?.[2].data).toEqual({ version: 2 });
  });

  test("reconciler is resilient when handles lack Symbol.dispose", () => {
    const renderer = vi.fn(
      (_data: unknown): RenderHandle => ({
        dom: { tagName: "div" } as unknown as HTMLElement,
        update: vi.fn(),
        // Intentionally no Symbol.dispose
      }),
    );
    const onAdd = vi.fn();
    const onUpdate = vi.fn();
    const onRemove = vi.fn();
    const reconciler = new RenderObjectReconciler({ onAdd, onUpdate, onRemove });

    reconciler.reconcile([makeObject("A", renderer)]);
    reconciler.reconcile([]);

    expect(onRemove).toHaveBeenCalledTimes(1);
    // Should not throw even though Symbol.dispose is missing
  });
});

describe("positionElement", () => {
  function makeEl(): HTMLElement {
    return {
      style: {} as CSSStyleDeclaration,
      dataset: {} as DOMStringMap,
    } as unknown as HTMLElement;
  }

  function makeObj(overrides?: Partial<RenderObject>): RenderObject {
    return {
      key: "test",
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      renderer: vi.fn() as unknown as RenderObject["renderer"],
      data: {},
      ...overrides,
    };
  }

  test("first call writes all style properties", () => {
    const el = makeEl();
    const obj = makeObj({ zIndex: 2, opacity: 0.5, testId: "my-el" });
    positionElement(el, obj);

    expect(el.style.position).toBe("absolute");
    expect(el.style.left).toBe("10px");
    expect(el.style.top).toBe("20px");
    expect(el.style.width).toBe("100px");
    expect(el.style.height).toBe("50px");
    expect(el.style.zIndex).toBe("2");
    expect(el.style.opacity).toBe("0.5");
    expect(el.dataset.testid).toBe("my-el");
    expect(el.dataset.key).toBe("test");
  });

  test("second call with same values does not touch style", () => {
    const el = makeEl();
    const obj = makeObj();
    positionElement(el, obj);

    // Replace style with a tracked version for the second call
    const setterCalls: string[] = [];
    const trackingStyle = new Proxy(el.style, {
      set(target, prop, value) {
        setterCalls.push(String(prop));
        (target as unknown as Record<string, unknown>)[String(prop)] = value;
        return true;
      },
    });
    (el as unknown as { style: CSSStyleDeclaration }).style = trackingStyle;

    positionElement(el, obj); // Same data — should skip all style writes
    expect(setterCalls).toHaveLength(0);
  });

  test("second call with changed x only updates left", () => {
    const el = makeEl();
    positionElement(el, makeObj({ x: 10 }));

    const setterCalls: string[] = [];
    const trackingStyle = new Proxy(el.style, {
      set(target, prop, value) {
        setterCalls.push(String(prop));
        (target as unknown as Record<string, unknown>)[String(prop)] = value;
        return true;
      },
    });
    (el as unknown as { style: CSSStyleDeclaration }).style = trackingStyle;

    positionElement(el, makeObj({ x: 99 }));
    expect(setterCalls).toContain("left");
    // Should not touch top, width, height
    expect(setterCalls).not.toContain("top");
    expect(setterCalls).not.toContain("width");
    expect(setterCalls).not.toContain("height");
  });
});
