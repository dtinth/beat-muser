# ADR 007: User Actions and Undo/Redo

## Status

Superseded by [ADR 008: Component-Stripping Deletion](008-component-stripping-deletion.md)

## Context

The editor needs undo/redo for mutations like deleting notes. We need a design that:

1. Supports batch operations (delete 5 notes = one undo step)
2. Integrates with the existing command system (toolbar, shortcuts, palette)
3. Works with the CRDT project format (tombstones, not hard deletes)
4. Doesn't bloat memory (history limit)
5. Keeps selection state sensible across undo/redo

## Decision

We will use a **two-layer design**: **Commands** (UI layer) wrap **UserActions** (model layer).

### UserAction Interface

```ts
interface UserAction {
  title: string;
  do(): void;
  undo(): void;
}
```

Actions are classes that capture the full state needed to reverse themselves. For `DeleteAction`, this means storing complete entity snapshots.

### History Manager (inside EditorController)

- Linear undo/redo stack stored in a single `$history` atom: `{ undo: UserAction[], redo: UserAction[] }`
- `applyAction(action)` pushes to undo stack, clears redo branch
- `undo()` pops from undo, pushes to redo, calls `action.undo()`
- `redo()` pops from redo, pushes to undo, calls `action.do()`
- Max 100 actions; oldest dropped when limit exceeded
- Only mutation actions push to history (zoom, scroll, selection do not)

### Deletion Semantics

- Delete moves entities to `ProjectFile.deletedEntities` with a new UUIDv7 version (tombstoning)
- Undo removes from `deletedEntities` and re-inserts into `entities`
- Clear selection on delete
- On undo, re-select restored entities **only if their level is currently visible**

### Controller API

```ts
editor.applyAction(action: UserAction): void
editor.undo(): void
editor.redo(): void
editor.$history: Atom<{ undo: UserAction[], redo: UserAction[] }>
```

## Consequences

- Commands stay lightweight (title, shortcut, execute closure)
- Actions encapsulate mutation + reversal logic
- Tests can create actions directly and assert on `$history` state
- CRDT properties preserved: deletions are tombstones with version bumps
- Memory bounded: 100-action limit prevents unbounded growth
- UI can subscribe to `$history` for disabled button states and menu labels

## Alternatives Considered

- **Commands as actions**: Would mix UI and model concerns. Rejected.
- **Branching undo tree**: Too complex for current needs. Rejected.
- **External history packlet**: Unnecessary indirection; history is tightly coupled to controller state. Rejected.
- **Store inverse operations instead of snapshots**: More abstract but harder to maintain for complex mutations. Rejected in favor of snapshot simplicity.
