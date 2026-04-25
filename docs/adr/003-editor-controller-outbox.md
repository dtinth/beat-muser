# ADR 003: EditorController Outbox Pattern

**Status:** Accepted (implementation pending)

**Date:** 2026-04-25

**Deciders:** dtinth, OpenCode

---

## Context

The `EditorController` owns all editor state (scroll, zoom, viewport, cursor). The `timeline-behavior` subscribes to controller atoms and maps visible render specs to DOM renderers. Data flow was intended to be unidirectional:

> UI scroll event → behavior → controller state update → UI refresh

But in practice, the flow became bidirectional and fragile. The zoom subscription in `timeline-behavior` both **reads** `$zoom` and **commands** the UI by calling `ctx.setScrollTop()`. This is a UI command leaking into a reactive subscription, creating chain reactions that are hard to trace.

## Decision

The controller exposes a **`nanoevents` outbox** for UI commands.

### Data Flow

```
User scrolls UI
    ↓
scrollable-canvas fires scroll event
    ↓
behavior.onScroll(scrollLeft, scrollTop)
    ↓
controller.setScrollTop(top)          ← state update
    ↓
controller outbox.emit('setScrollTop', top)   ← UI command
    ↓
behavior subscribes to outbox
    ↓
behavior calls ctx.setScrollTop(top)   ← UI action
    ↓
scrollable-canvas scrolls
```

### Rules

1. **Controller owns all state.** Behavior is thin glue — it forwards user input to the controller and acts on controller commands.
2. **Controller emits UI commands via the outbox.** The outbox is a `nanoevents` emitter typed to UI actions (e.g., `setScrollTop`).
3. **Behavior subscribes to the outbox** and translates commands into `scrollable-canvas` API calls.
4. **No controller method calls `ctx.*` directly.** All UI side effects go through the outbox.

## Status

- `nanoevents` installed (`vp add nanoevents`).
- Outbox interface defined but not yet wired into `EditorController` or `timeline-behavior`.

## Consequences

### Positive

- Strict unidirectional data flow. Easy to trace: user input goes in, commands come out.
- Controller is testable in isolation — no canvas or DOM dependency.
- No more "which subscription is calling `ctx.setScrollTop`?" confusion.

### Negative / Risks

- Slightly more indirection than direct subscription.
- Need to ensure outbox events are idempotent (e.g., `setScrollTop` with the same value should be a no-op).

## Related Code

- `src/packlets/editor-core/index.ts` — `EditorController`
- `src/packlets/project-view/timeline-behavior.ts` — behavior factory
- `package.json` — `nanoevents` dependency
