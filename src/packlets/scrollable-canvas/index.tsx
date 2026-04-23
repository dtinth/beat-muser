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
}

/**
 * Context provided to the behavior factory. Gives read-only access to
 * scroll state and methods for coordinate conversion and refresh scheduling.
 */
export interface ScrollableCanvasContext {
  viewportToContent(x: number, y: number): { x: number; y: number };
  contentToViewport(x: number, y: number): { x: number; y: number };
  refresh(): void;
  setScrollTop(top: number): void;
  setScrollLeft(left: number): void;
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

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    return mountScrollableCanvas(container, behaviorFactory);
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
      }}
    >
      <div
        style={{
          position: "relative",
          overflow: "hidden",
        }}
      />
    </div>
  );
}

function mountScrollableCanvas(
  container: HTMLDivElement,
  behaviorFactory: ScrollableCanvasBehaviorFactory,
) {
  let pendingRaf: number | null = null;
  let isRefreshing = false;
  let pendingScrollTop: number | null = null;
  let pendingScrollLeft: number | null = null;
  let isDisposed = false;
  let hasConnected = false;
  const handles = new Map<string, RenderHandle>();

  // The content wrapper is the only child of the container. Rendered
  // elements are appended to it. Its explicit width/height create the
  // scrollable area, and position:relative makes it the containing block
  // for absolutely-positioned children.
  const scrollableContent = container.firstElementChild as HTMLElement | null;

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
      if (isRefreshing) {
        throw new Error("Cannot call ctx.refresh() from within getVisibleObjects()");
      }
      if (pendingRaf === null) {
        pendingRaf = requestAnimationFrame(doRender);
      }
    },
    setScrollTop(top) {
      pendingScrollTop = top;
      if (pendingRaf === null) {
        pendingRaf = requestAnimationFrame(doRender);
      }
    },
    setScrollLeft(left) {
      pendingScrollLeft = left;
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
    isRefreshing = true;

    try {
      // Size the spacer first so that onConnected and pending scroll
      // have a meaningful scrollable area to work with.
      const contentSize = behaviorInstance.getContentSize();
      if (scrollableContent) {
        scrollableContent.style.width = `${contentSize.width}px`;
        scrollableContent.style.height = `${contentSize.height}px`;
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

      const visibleObjects = behaviorInstance.getVisibleObjects();
      const activeKeys = new Set<string>();

      for (const obj of visibleObjects) {
        activeKeys.add(obj.key);
        const existing = handles.get(obj.key);

        if (existing) {
          existing.update(obj.data);
          positionElement(existing.dom, obj);
        } else {
          const handle = obj.renderer(obj.data);
          handles.set(obj.key, handle);
          positionElement(handle.dom, obj);
          scrollableContent?.appendChild(handle.dom);
        }
      }

      for (const [key, handle] of handles) {
        if (!activeKeys.has(key)) {
          handle[Symbol.dispose]?.();
          handle.dom.remove();
          handles.delete(key);
        }
      }
    } finally {
      isRefreshing = false;
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
    for (const handle of handles.values()) {
      handle[Symbol.dispose]?.();
      handle.dom.remove();
    }
    handles.clear();
    behaviorInstance[Symbol.dispose]?.();
  };
}

function positionElement(el: HTMLElement, obj: RenderObject) {
  el.style.position = "absolute";
  el.style.left = `${obj.x}px`;
  el.style.top = `${obj.y}px`;
  el.style.width = `${obj.width}px`;
  el.style.height = `${obj.height}px`;
  if (obj.testId) {
    el.dataset.testid = obj.testId;
  }
  el.dataset.key = obj.key;
}
