# ADR 008: Component-Stripping Deletion (Supersedes 007)

## Status

Accepted — Supersedes [ADR 007: User Actions and Undo/Redo](007-user-actions-and-undo.md)

## Context

ADR 007 prescribed tombstone-based deletion: entities were hard-removed from `entities` and moved to a `deletedEntities` array with a new version. After further reading on ECS design and CRDT simplicity, we realized tombstones add unnecessary indirection.

## Decision

Deletion is **component-stripping**, not tombstoning.

### How it works

- To delete an entity, remove all its components and bump its `version` to a new UUIDv7.
- The entity remains in the `entities` array with `components: {}`.
- `EntityManager.entitiesWithComponent()` naturally excludes it because it carries no components.
- `EntityManager.get()` still returns the empty entity, which is harmless — any code querying by component won't see it.

### Why this is safe for CRDT merge

Merge rule: union by `id`, higher `version` wins.

| Scenario                                                        | Result                                                        |
| --------------------------------------------------------------- | ------------------------------------------------------------- |
| A deletes (V2, empty components), B edits (V1, full components) | V2 wins → empty components. Correct: deletion beats old edit. |
| A deletes (V2), B deletes (V3)                                  | V3 wins → still empty components. Correct.                    |
| A creates (V1, `{note: ...}`), B never sees it                  | V1 wins → entity exists. Correct.                             |

The creation invariant (every new entity has ≥1 component) guarantees that `components: {}` can only arise from intentional deletion.

### EntityManager API

```ts
class EntityManager {
  delete(id: string): void; // strips components, bumps version
  restore(entity: Entity): void; // re-inserts full entity snapshot
}
```

### Undo/Redo unchanged

The `UserAction` layer from ADR 007 is preserved. `DeleteUserAction` captures full entity snapshots before calling `entityManager.delete()`, and restores them via `entityManager.restore()` on undo.

## Consequences

- **Simpler project format:** Single `entities` array. No `deletedEntities`.
- **Simpler merge logic:** One collection to union. No tombstone array to reconcile.
- **ECS-aligned:** An entity without components "ceases to exist" — pure ECS semantics.
- **Monotonic growth:** The `entities` array grows forever. For typical beatmaps (thousands of notes), this is negligible. Acceptable trade-off for CRDT correctness.
- **Parser/tests simplified:** No `deletedEntities` field to validate or populate.

## Changes from ADR 007

| Aspect             | ADR 007                        | ADR 008                          |
| ------------------ | ------------------------------ | -------------------------------- |
| Deletion mechanism | Tombstone to `deletedEntities` | Strip components, bump version   |
| Project format     | `entities` + `deletedEntities` | `entities` only                  |
| EntityManager role | `remove(id)` only              | `delete(id)` + `restore(entity)` |
| CRDT merge         | Two arrays to reconcile        | Single array, version wins       |

## References

- `src/packlets/entity-manager/index.ts` — `delete()` and `restore()` methods
- `src/packlets/editor-core/index.ts` — `DeleteUserAction` using component-stripping
- `src/packlets/project-format/schema.ts` — Schema without `deletedEntities`
