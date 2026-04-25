# ADR 002: Render State as Manual Atom

**Status:** Accepted

**Date:** 2026-04-25

**Deciders:** dtinth, OpenCode

---

## Context

The editor timeline uses a `scrollable-canvas` component that renders objects imperatively via a `getVisibleObjects()` callback inside a `requestAnimationFrame` loop (`doRender`). The list of visible objects depends on scroll position, zoom, viewport size, cursor position, and chart data — all state owned by `EditorController`.

Initially, `$visibleRenderObjects` was a `computed` atom derived from these inputs. This caused two problems:

1. **Synchronous re-render loops.** `onConnected` (called inside `doRender`) triggered state updates that invalidated the computed atom. Subscribers to the computed atom fired synchronously inside `doRender`, calling `ctx.refresh()`, which threw because a render was already in progress.

2. **Fragile update ordering.** Computed atoms recompute lazily on read. If `getVisibleObjects()` was called before the computed atom had a chance to notice an upstream change, it would return stale data.

## Decision

`$visibleRenderObjects` is a **plain `atom`**, not a `computed` atom.

`updateVisibleRenderObjects()` is called **manually** at the end of every state-changing method:

- `setScrollTop()`
- `setCursor()`
- `setZoom()`
- `setSnap()`
- `setViewportSize()`

### Invariant: No state updates inside `doRender`

The `scrollable-canvas` `ctx.refresh()` guard is narrowed: it only throws when called from within `getVisibleObjects()`, not from anywhere inside `doRender`. This allows subscriptions to fire safely during `onConnected`.

However, `onConnected` must **not** call controller methods that update `$visibleRenderObjects`. It only calls `ctx.setScrollTop()`. The browser fires a scroll event; `onScroll` syncs to the controller; the controller updates `$scrollTop` and then calls `updateVisibleRenderObjects()` — all outside `doRender`.

## Consequences

### Positive

- Predictable update timing. Render specs are recalculated exactly when state changes, not lazily on read.
- No synchronous re-render loops. `doRender` never triggers itself.
- Clear ownership: the controller decides when to update visible objects.

### Negative / Risks

- Easy to forget to call `updateVisibleRenderObjects()` in a new state-changing method.
- Slightly more boilerplate than a computed atom.

## Related Code

- `src/packlets/editor-core/index.ts` — `EditorController`
- `src/packlets/scrollable-canvas/index.tsx` — `doRender`, `ctx.refresh()` guard
- `src/packlets/project-view/timeline-behavior.ts` — behavior factory
