# ADR 010: Vertical Slice Architecture for Editor Core

## Status

Accepted

## Context

`EditorController` grew to ~1000 lines owning ~15 reactive atoms, entity CRUD, viewport geometry, input handling, selection, box selection, history, render spec generation, and timing engine caching. This makes the file a God Class — any new feature touches it, and unit testing requires a full controller instance.

We need a decomposition strategy that:

1. Breaks `EditorController` into smaller, independently testable units
2. Keeps the dependency graph acyclic (cyclic dependencies are "outlawed")
3. Allows incremental migration — old code stays in the facade, new code lives in slices
4. Prevents the wrong abstraction (e.g., premature `TimelineRenderer` extraction that creates cyclic deps)

## Decision

Use a **vertical slice architecture** with a typesafe DI container (`EditorContext`).

### Core Concepts

| Term                          | Definition                                                                                                                 |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Slice**                     | A feature module that owns state (atoms), methods, and optionally events. Has a `static sliceKey` for registration.        |
| **EditorContext**             | DI container. `register()` creates a slice. `get(SliceClass)` retrieves it. Descriptive errors on missing/duplicate keys.  |
| **Facade (EditorController)** | Thin orchestration layer. Delegates to slices. Keeps legacy code during migration. New code does NOT depend on the facade. |
| **Atom**                      | Persistent reactive state. Owned by exactly one slice. Other slices read via `ctx.get().$atom`.                            |
| **NanoEvents**                | Fire-and-forget communication. Used when one slice produces a transient signal another consumes (e.g., "snap changed").    |

### Key Rule: Facade Is Not in the Dependency Graph

Slices depend on slices via `ctx.get()`. The facade registers slices and wires listeners, but slices never call back to the facade. This guarantees acyclicity at the slice level.

### Registration with Factories

Not all slices are constructible with `new Slice(ctx)` alone. Some need external data (e.g., the project file). `EditorContext.register` supports a factory overload:

```ts
// Simple slice: no external deps
ctx.register(SnapSlice);

// Complex slice: needs project data
ctx.register(ProjectSlice, (ctx) => new ProjectSlice(ctx, options.project));
```

The factory closure captures external data. The container only checks `sliceKey` — it does not enforce constructor signatures.

### Slices Are Sometimes "Useless" Today

Some slices start as thin wrappers. This is intentional. Example: `ProjectSlice` may initially only expose `entityManager`. The value is not in the complexity it removes today, but in the **contract it establishes** for other slices to depend on. When `TimingSlice` is extracted tomorrow, it depends on `ProjectSlice`, not the facade.

### Rejected Alternatives

| Option                                  | Why Rejected                                                                                                                                                                                                                                                  |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Extract `TimelineRenderer`**          | Would need to read ~10 atoms from the controller. Creates implicit "friend class" coupling. Wrong abstraction — better to decompose `getVisibleRenderSpecs()` into private helpers first.                                                                     |
| **Cache key from entity versions**      | Requires hashing all relevant entity states on every `getTimingEngine()` call, defeating the cache purpose. Manual dirty flag is simpler and zero-overhead on reads.                                                                                          |
| **Numeric `layer` property on Slice**   | Added preemptively for runtime dependency enforcement. Never used by `EditorContext`. Dependency graph is already explicit via `ctx.get()` calls. If automated cycle detection is needed later, `static dependencies = [OtherSlice]` is a better abstraction. |
| **Static dependency declaration array** | Considered as future enhancement. Not implemented yet because the dependency graph is small and manually verified.                                                                                                                                            |

### State Ownership Guidelines

| State Type                            | Owner            | Access Pattern                  |
| ------------------------------------- | ---------------- | ------------------------------- |
| Persistent reactive data              | Slice atom       | `ctx.get(Slice).$atom`          |
| Transient signals                     | NanoEvents       | `ctx.get(Slice).onEvent(cb)`    |
| View state (which levels are visible) | Facade (for now) | Direct atom access              |
| Orchestration logic                   | Facade           | Calls slice methods in sequence |

### Migration Strategy

1. Build infrastructure (`EditorContext`, `Slice` base class)
2. Extract low-dependency slices first (`SnapSlice`, `ZoomSlice`, `ProjectSlice`)
3. Work up the dependency DAG: `ViewportSlice` → `CursorSlice` → `SelectionSlice` → `BoxSelectionSlice` → `RenderSlice` → `InteractionSlice`
4. The facade shrinks as slices absorb responsibility
5. When the facade is thin enough, evaluate whether it should exist at all or become pure wiring

## Consequences

- **Incremental:** Each slice extraction is a small, reviewable commit
- **Testable:** Slices can be unit-tested in isolation with mocked dependencies
- **No cyclic deps:** By construction — slices never reference the facade
- **Slightly more indirection:** `ctx.get(Slice).method()` vs `this.method()`. Acceptable trade-off for clarity
- **Registration order matters:** Nanostores `.subscribe()` fires immediately. Slices must be registered before any subscription that triggers cross-slice reads

## References

- `src/packlets/editor-core/editor-context.ts` — DI container with `register`/`get`
- `src/packlets/editor-core/slice.ts` — `Slice` base class with `static sliceKey`
- `src/packlets/editor-core/slices/` — individual slice implementations
- `src/packlets/editor-core/editor-controller.ts` — facade delegating to slices
