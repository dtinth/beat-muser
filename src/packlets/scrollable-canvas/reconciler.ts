/**
 * @packageDocumentation
 *
 * Handle lifecycle reconciler for the scrollable canvas.
 *
 * Owns the `Map<string, RenderHandle>` and drives creation, update,
 * and disposal of render handles based on successive `RenderObject[]`
 * snapshots.  DOM (or test) concerns are injected via `ReconcileCallbacks`.
 */

import type { RenderHandle, RenderObject } from "./index";

export interface ReconcileCallbacks {
  onAdd(key: string, handle: RenderHandle, obj: RenderObject): void;
  onUpdate(key: string, handle: RenderHandle, obj: RenderObject): void;
  onRemove(key: string, handle: RenderHandle): void;
}

/**
 * Reconciles a stream of `RenderObject` snapshots against an internal
 * `Map<string, RenderHandle>`.
 *
 * - New keys → `renderer()` → `onAdd`
 * - Existing keys → `handle.update()` → `onUpdate`
 * - Stale keys → `handle[Symbol.dispose]()` → `onRemove`
 */
export class RenderObjectReconciler {
  private handles = new Map<string, RenderHandle>();
  private callbacks: ReconcileCallbacks;

  constructor(callbacks: ReconcileCallbacks) {
    this.callbacks = callbacks;
  }

  reconcile(objects: RenderObject[]): void {
    const activeKeys = new Set<string>();

    for (const obj of objects) {
      activeKeys.add(obj.key);
      const existing = this.handles.get(obj.key);
      if (existing) {
        existing.update(obj.data);
        this.callbacks.onUpdate(obj.key, existing, obj);
      } else {
        const handle = obj.renderer(obj.data);
        this.handles.set(obj.key, handle);
        this.callbacks.onAdd(obj.key, handle, obj);
      }
    }

    for (const [key, handle] of this.handles) {
      if (!activeKeys.has(key)) {
        handle[Symbol.dispose]?.();
        this.callbacks.onRemove(key, handle);
        this.handles.delete(key);
      }
    }
  }

  disposeAll(): void {
    for (const [key, handle] of this.handles) {
      handle[Symbol.dispose]?.();
      this.callbacks.onRemove(key, handle);
    }
    this.handles.clear();
  }
}
