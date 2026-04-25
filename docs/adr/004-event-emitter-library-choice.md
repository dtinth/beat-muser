# ADR 004: Event Emitter Library Choice

**Status:** Accepted

**Date:** 2026-04-25

**Deciders:** dtinth, OpenCode

---

## Context

We needed a typed event emitter for the `EditorController` outbox (see ADR 003). The outbox emits UI commands (e.g., `setScrollTop`) that the `timeline-behavior` subscribes to and acts upon.

## Options Considered

### A. Typed Callback Interface (Zero-Dependency)

```ts
class EditorController {
  private scrollRequestListeners: ((top: number) => void)[] = [];

  onScrollRequest(cb: (top: number) => void): () => void {
    this.scrollRequestListeners.push(cb);
    return () => {
      /* remove */
    };
  }
}
```

**Pros:** Zero dependencies; simplest for a single event type.
**Cons:** Ad-hoc implementation; does not scale if the outbox grows to multiple event types; no shared convention.

### B. nanostores Lifecycle Hooks (`onSet`, `onNotify`)

Already available since we use `nanostores`.

**Pros:** Zero new dependencies.
**Cons:** `onSet`/`onNotify` are designed for store lifecycle, not for semantic commands. Using them for UI commands is a misuse of the API and creates confusion between state changes and side-effect commands.

### C. mitt

A popular ~200B event emitter.

**Pros:** Well-known, battle-tested.
**Cons:** Different package from a different author; adds another dependency to the mental model. No strong technical advantage over `nanoevents`.

### D. nanoevents

A ~200B typed event emitter from the same ecosystem as `nanostores`.

**Pros:**

- Typed events: `createNanoEvents<{ setScrollTop: (top: number) => void }>()`
- Same ecosystem (Andrey Sitnik / nanostores org) — consistent API style
- Tiny footprint (~200B)
- Clean `emit` / `on` / `off` API

**Cons:** Adds a new dependency (though tiny).

## Decision

**Option D: `nanoevents`.**

We installed it via `vp add nanoevents`.

The typed API makes the outbox contract explicit. The ecosystem alignment with `nanostores` keeps the project's reactive stack cohesive.

## Consequences

### Positive

- Type-safe event contracts. Mis-typed event names are caught at compile time.
- Scales naturally if the outbox grows to more commands (e.g., `focusElement`, `flashIndicator`).
- Consistent with the nanostores reactive style already in the project.

### Negative / Risks

- One more dependency to track (though tiny and stable).

## Related Code

- `package.json` — `nanoevents` dependency
- `docs/adr/003-editor-controller-outbox.md` — The outbox pattern that uses this emitter
