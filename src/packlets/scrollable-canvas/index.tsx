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
import { perf } from "../perf/index.ts";
import type { Point } from "../geometry/index.ts";
import { RenderObjectReconciler } from "./reconciler.ts";

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
  /**
   * Opacity for the element. 0 = fully transparent, 1 = fully opaque.
   * Applied as CSS `opacity`.
   */
  opacity?: number;
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
  onScroll?(
    scrollLeft: number,
    scrollTop: number,
    viewportWidth: number,
    viewportHeight: number,
  ): void;
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
        // Both are required: React does not auto-prefix inline styles, and
        // iPadOS/desktop Safari only honors the `-webkit-` variant.
        WebkitUserSelect: "none",
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
  let lastViewportWidth = 0;
  let lastViewportHeight = 0;
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

    perf.incrementCounter("reconcileNumber");

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
      const visibleObjects = perf.measure("reconcile:getVisibleObjects", () =>
        behaviorInstance.getVisibleObjects(),
      );
      perf.measure("reconcile:dom", () => {
        reconciler.reconcile(visibleObjects);
      });
    } finally {
      isInGetVisibleObjects = false;
    }
  }

  function handleScroll() {
    behaviorInstance.onScroll?.(
      container.scrollLeft,
      container.scrollTop,
      container.clientWidth,
      container.clientHeight,
    );
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

  // iPadOS Safari (and desktop WebKit) still start a native text selection /
  // drag-image gesture on a mouse drag even with `user-select: none` and
  // `preventDefault()` on pointerdown. Cancelling `selectstart`/`dragstart`
  // directly is the reliable way to suppress it. The canvas has no selectable
  // text of its own, so this is safe.
  const preventDefault = (e: Event) => e.preventDefault();

  container.addEventListener("scroll", handleScroll, { passive: true });
  container.addEventListener("selectstart", preventDefault);
  container.addEventListener("dragstart", preventDefault);
  container.addEventListener("pointerdown", handlePointerEvent);
  container.addEventListener("pointermove", handlePointerEvent);
  container.addEventListener("pointerup", handlePointerEvent);
  container.addEventListener("pointercancel", handlePointerEvent);

  const resizeObserver = new ResizeObserver(() => {
    const vw = container.clientWidth;
    const vh = container.clientHeight;
    if (vw !== lastViewportWidth || vh !== lastViewportHeight) {
      lastViewportWidth = vw;
      lastViewportHeight = vh;
      behaviorInstance.onScroll?.(container.scrollLeft, container.scrollTop, vw, vh);
    }
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
    container.removeEventListener("selectstart", preventDefault);
    container.removeEventListener("dragstart", preventDefault);
    container.removeEventListener("pointerdown", handlePointerEvent);
    container.removeEventListener("pointermove", handlePointerEvent);
    container.removeEventListener("pointerup", handlePointerEvent);
    container.removeEventListener("pointercancel", handlePointerEvent);
    reconciler.disposeAll();
    behaviorInstance[Symbol.dispose]?.();
  };
}

interface ElementCache {
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number | undefined;
  opacity: number | undefined;
  testId: string | undefined;
}

const elementCache = new WeakMap<HTMLElement, ElementCache>();

export function positionElement(el: HTMLElement, obj: RenderObject) {
  const prev = elementCache.get(el);

  if (!prev) {
    // First call: write everything including position: absolute
    el.style.position = "absolute";
    el.style.left = `${obj.x}px`;
    el.style.top = `${obj.y}px`;
    el.style.width = `${obj.width}px`;
    el.style.height = `${obj.height}px`;
    if (obj.zIndex !== undefined) {
      el.style.zIndex = String(obj.zIndex);
    }
    if (obj.opacity !== undefined) {
      el.style.opacity = String(obj.opacity);
    }
    if (obj.testId) {
      el.dataset.testid = obj.testId;
    }
    el.dataset.key = obj.key;
    elementCache.set(el, {
      x: obj.x,
      y: obj.y,
      width: obj.width,
      height: obj.height,
      zIndex: obj.zIndex,
      opacity: obj.opacity,
      testId: obj.testId,
    });
    return;
  }

  // Subsequent calls: only touch changed fields
  if (prev.x !== obj.x) {
    el.style.left = `${obj.x}px`;
    prev.x = obj.x;
  }
  if (prev.y !== obj.y) {
    el.style.top = `${obj.y}px`;
    prev.y = obj.y;
  }
  if (prev.width !== obj.width) {
    el.style.width = `${obj.width}px`;
    prev.width = obj.width;
  }
  if (prev.height !== obj.height) {
    el.style.height = `${obj.height}px`;
    prev.height = obj.height;
  }
  if (prev.zIndex !== obj.zIndex) {
    if (obj.zIndex !== undefined) {
      el.style.zIndex = String(obj.zIndex);
    } else {
      el.style.removeProperty("z-index");
    }
    prev.zIndex = obj.zIndex;
  }
  if (prev.opacity !== obj.opacity) {
    if (obj.opacity !== undefined) {
      el.style.opacity = String(obj.opacity);
    } else {
      el.style.removeProperty("opacity");
    }
    prev.opacity = obj.opacity;
  }
  if (prev.testId !== obj.testId) {
    if (obj.testId) {
      el.dataset.testid = obj.testId;
    }
    prev.testId = obj.testId;
  }
}
