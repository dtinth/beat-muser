/**
 * @packageDocumentation
 *
 * A generic scrollable canvas component that renders objects using a
 * delegate (behavior) pattern. Designed to be completely decoupled from
 * any editor logic.
 *
 * ## Architecture
 *
 * - **`<ScrollableCanvas behavior={factory} />`** — the React component.
 *   `behavior` is a factory function called on mount that receives a
 *   `ScrollableCanvasContext` and returns a `ScrollableCanvasBehavior`.
 * - **`ScrollableCanvasBehavior`** — the delegate that tells the canvas
 *   what to render and responds to scroll/pointer events.
 * - **`ScrollableCanvasContext`** — provided to the behavior, giving it
 *   read-only access to scroll state and methods for coordinate conversion
 *   and refresh scheduling.
 * - **`RenderObject<T>`** — a visible object with position, size, a typed
 *   renderer, and data.
 * - **`Renderer<T>`** — a factory that creates a `RenderHandle<T>`.
 * - **`RenderHandle<T>`** — owns a DOM node, can update it, and can be
 *   disposed.
 *
 * ## Rendering lifecycle
 *
 * 1. Canvas calls `behavior.getContentSize()` to set the scrollable area.
 * 2. Canvas calls `behavior.getVisibleObjects()` to get visible objects.
 * 3. For each object:
 *    - New key → `renderer(data)` → append `handle.dom`
 *    - Existing key → `handle.update(data)`
 *    - Stale key → `handle[Symbol.dispose]?.()` → remove `handle.dom`
 * 4. Canvas positions each `handle.dom` absolutely.
 *
 * All updates are batched via `requestAnimationFrame` to avoid redundant
 * renders within a single frame. Calling `ctx.refresh()` schedules a
 * re-render; calling it multiple times within a frame is a no-op after
 * the first. Re-entrant `refresh()` throws.
 */

import { useEffect, useRef } from "react";
import type { Point } from "../geometry";
import { RenderObjectReconciler } from "./reconciler";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Render handle returned by a `Renderer`. Owns a DOM node and can update it.
 * Generic for type safety within typed renderers; the canvas treats all
 * handles as `RenderHandle<unknown>`.
 */
export interface RenderHandle<T = unknown> {
  dom: HTMLElement;
  update(data: T): void;
  [Symbol.dispose]?: () => void;
}

/**
 * Factory that creates a `RenderHandle` for a given data object.
 * Called once when a render object enters the viewport.
 */
export type Renderer<T = unknown> = (data: T) => RenderHandle<T>;

/**
 * A visible object within the scrollable canvas.
 * `key` must be unique across all objects returned by `getVisibleObjects()`.
 * The `data` field is passed to the renderer's `update` method.
 */
export interface RenderObject {
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
  renderer: Renderer;
  data: unknown;
  /** Optional test ID applied as `data-testid` for debugging/testing. */
  testId?: string;
  /**
   * Rendering layer. `"scroll"` (default) scrolls with content.
   * `"sticky"` stays fixed to viewport top while scrolling horizontally.
   *
   * **Note:** The layer is read only when a handle is first created.
   * Changing `layer` on subsequent renders has no effect.
   */
  layer?: "scroll" | "sticky";
  /**
   * Z-index for stacking order within the same layer. Higher values
   * appear above lower values. Defaults to 0.
   */
  zIndex?: number;
}

/**
 * Context provided to the behavior factory. Gives read-only access to
 * scroll state and methods for coordinate conversion and refresh scheduling.
 */
export interface ScrollableCanvasContext {
  viewportToContent(x: number, y: number): { x: number; y: number };
  contentToViewport(x: number, y: number): { x: number; y: number };
  refresh(): void;
  setScroll(point: Point): void;
  readonly scrollLeft: number;
  readonly scrollTop: number;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
}

/**
 * Delegate that the ScrollableCanvas calls to query content and respond to
 * events. Created by a factory function passed as the `behavior` prop.
 */
export interface ScrollableCanvasBehavior {
  getContentSize(): { width: number; height: number };
  getVisibleObjects(): RenderObject[];
  onConnected?(): void;
  onScroll?(scrollLeft: number, scrollTop: number): void;
  onPointerEvent?(event: PointerEvent, contentX: number, contentY: number): void;
  [Symbol.dispose]?: () => void;
}

/**
 * Factory function passed as the `behavior` prop. Called once on mount
 * with the canvas context. Must return a `ScrollableCanvasBehavior`.
 */
export type ScrollableCanvasBehaviorFactory = (
  ctx: ScrollableCanvasContext,
) => ScrollableCanvasBehavior;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ScrollableCanvasProps {
  behavior: ScrollableCanvasBehaviorFactory;
}

export function ScrollableCanvas({ behavior: behaviorFactory }: ScrollableCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stickyLayerRef = useRef<HTMLDivElement>(null);
  const scrollLayerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const stickyLayer = stickyLayerRef.current;
    const scrollLayer = scrollLayerRef.current;
    if (!container || !stickyLayer || !scrollLayer) return;

    return mountScrollableCanvas(container, stickyLayer, scrollLayer, behaviorFactory);
  }, [behaviorFactory]);

  return (
    <div
      ref={containerRef}
      data-testid="scrollable-canvas-root"
      style={{
        position: "relative",
        overflow: "auto",
        width: "100%",
        height: "100%",
        userSelect: "none",
      }}
    >
      {/* Sticky layer: rendered first so it sits above scroll layer. */}
      <div
        ref={stickyLayerRef}
        data-testid="sticky-layer"
        style={{
          position: "sticky",
          top: 0,
          height: 0,
          overflow: "visible",
          zIndex: 1,
        }}
      />
      {/* Scroll layer: main content area. */}
      <div
        ref={scrollLayerRef}
        data-testid="scroll-layer"
        style={{
          position: "relative",
          overflow: "hidden",
          zIndex: 0,
        }}
      />
    </div>
  );
}

function mountScrollableCanvas(
  container: HTMLDivElement,
  stickyLayer: HTMLDivElement,
  scrollLayer: HTMLDivElement,
  behaviorFactory: ScrollableCanvasBehaviorFactory,
) {
  let pendingRaf: number | null = null;
  let isInGetVisibleObjects = false;
  let pendingScrollTop: number | null = null;
  let pendingScrollLeft: number | null = null;
  let isDisposed = false;
  let hasConnected = false;
  const reconciler = new RenderObjectReconciler({
    onAdd(_key, handle, obj) {
      positionElement(handle.dom, obj);
      const layer = obj.layer === "sticky" ? stickyLayer : scrollLayer;
      layer?.appendChild(handle.dom);
    },
    onUpdate(_key, handle, obj) {
      positionElement(handle.dom, obj);
    },
    onRemove(_key, handle) {
      handle.dom.remove();
    },
  });

  const ctx: ScrollableCanvasContext = {
    viewportToContent(x, y) {
      return {
        x: x + container.scrollLeft,
        y: y + container.scrollTop,
      };
    },
    contentToViewport(x, y) {
      return {
        x: x - container.scrollLeft,
        y: y - container.scrollTop,
      };
    },
    refresh() {
      if (isInGetVisibleObjects) {
        throw new Error("Cannot call ctx.refresh() from within getVisibleObjects()");
      }
      if (pendingRaf === null) {
        pendingRaf = requestAnimationFrame(doRender);
      }
    },
    setScroll({ x, y }) {
      pendingScrollLeft = x;
      pendingScrollTop = y;
      if (pendingRaf === null) {
        pendingRaf = requestAnimationFrame(doRender);
      }
    },
    get scrollLeft() {
      return container.scrollLeft;
    },
    get scrollTop() {
      return container.scrollTop;
    },
    get viewportWidth() {
      return container.clientWidth;
    },
    get viewportHeight() {
      return container.clientHeight;
    },
  };

  const behaviorInstance = behaviorFactory(ctx);

  function doRender() {
    pendingRaf = null;
    if (isDisposed) return;

    try {
      // Size both layers so that onConnected and pending scroll have a
      // meaningful scrollable area to work with.
      const contentSize = behaviorInstance.getContentSize();
      if (stickyLayer) {
        stickyLayer.style.width = `${contentSize.width}px`;
        stickyLayer.style.height = "0px";
      }
      if (scrollLayer) {
        scrollLayer.style.width = `${contentSize.width}px`;
        scrollLayer.style.height = `${contentSize.height}px`;
      }

      if (!hasConnected) {
        hasConnected = true;
        behaviorInstance.onConnected?.();
      }

      if (pendingScrollTop !== null) {
        container.scrollTop = pendingScrollTop;
        pendingScrollTop = null;
      }
      if (pendingScrollLeft !== null) {
        container.scrollLeft = pendingScrollLeft;
        pendingScrollLeft = null;
      }

      isInGetVisibleObjects = true;
      const visibleObjects = behaviorInstance.getVisibleObjects();
      reconciler.reconcile(visibleObjects);
    } finally {
      isInGetVisibleObjects = false;
    }
  }

  function handleScroll() {
    behaviorInstance.onScroll?.(container.scrollLeft, container.scrollTop);
    if (pendingRaf === null) {
      pendingRaf = requestAnimationFrame(doRender);
    }
  }

  function handlePointerEvent(e: PointerEvent) {
    const rect = container.getBoundingClientRect();
    const viewportX = e.clientX - rect.left;
    const viewportY = e.clientY - rect.top;
    const contentX = viewportX + container.scrollLeft;
    const contentY = viewportY + container.scrollTop;
    behaviorInstance.onPointerEvent?.(e, contentX, contentY);
  }

  container.addEventListener("scroll", handleScroll, { passive: true });
  container.addEventListener("pointerdown", handlePointerEvent);
  container.addEventListener("pointermove", handlePointerEvent);
  container.addEventListener("pointerup", handlePointerEvent);

  const resizeObserver = new ResizeObserver(() => {
    if (pendingRaf === null) {
      pendingRaf = requestAnimationFrame(doRender);
    }
  });
  resizeObserver.observe(container);

  pendingRaf = requestAnimationFrame(doRender);

  return () => {
    if (pendingRaf !== null) {
      cancelAnimationFrame(pendingRaf);
      pendingRaf = null;
    }
    isDisposed = true;
    resizeObserver.disconnect();
    container.removeEventListener("scroll", handleScroll);
    container.removeEventListener("pointerdown", handlePointerEvent);
    container.removeEventListener("pointermove", handlePointerEvent);
    container.removeEventListener("pointerup", handlePointerEvent);
    reconciler.disposeAll();
    behaviorInstance[Symbol.dispose]?.();
  };
}

function positionElement(el: HTMLElement, obj: RenderObject) {
  el.style.position = "absolute";
  el.style.left = `${obj.x}px`;
  el.style.top = `${obj.y}px`;
  el.style.width = `${obj.width}px`;
  el.style.height = `${obj.height}px`;
  if (obj.zIndex !== undefined) {
    el.style.zIndex = String(obj.zIndex);
  }
  if (obj.testId) {
    el.dataset.testid = obj.testId;
  }
  el.dataset.key = obj.key;
}
