# ADR 009: Note Placement with Pencil Tool

## Status

Accepted

## Context

The editor needs a way to create new entities (notes, BPM changes, time signatures) on the timeline. This is a core authoring workflow. We considered several interaction models:

1. **Drag-and-drop from a palette** — requires a separate UI panel, feels indirect.
2. **Double-click to edit/insert** — common in DAWs but conflicts with our existing click-to-select behavior.
3. **Toolbar tool + click on timeline** — industry standard (Figma, Photoshop, BMS editors). The toolbar already has a Pencil button as a placeholder.

We chose option 3 because it aligns with the existing toolbar, preserves single-click selection, and scales to multiple entity types.

## Decision

Use a **toolbar-driven active tool** system. When the **Pencil** tool is active, clicking on the timeline places an entity whose type is determined by the column under the cursor.

### Tool State

- `$activeTool` atom on `EditorController` with values: `select | pencil | erase | pan`
- Default: `select`
- Keyboard shortcuts: `Q` (select), `W` (pencil), `E` (erase), `R` (pan)
- Toolbar buttons reflect active state with highlight

### Column-Driven Placement

Each `TimelineColumn` carries an optional `placementHandler: (pulse: number) => Entity | null`. This makes placement **declarative and extensible** — new column types automatically gain placement capability by providing a handler.

| Column Type           | Handler Behavior                                                                        |
| --------------------- | --------------------------------------------------------------------------------------- |
| Gameplay lane         | Creates `event` + `note` + `levelRef` + `chartRef`                                      |
| BPM column            | Creates `event` + `bpmChange` + `chartRef`, default BPM = current BPM at that pulse     |
| Time signature column | Creates `event` + `timeSignature` + `chartRef`, default sig = current sig at that pulse |
| Measure / Spacer      | No handler (non-placeable)                                                              |

### Interaction Rules

- **Pointer down** places the entity immediately — no drag required.
- **No hit testing** in pencil mode — clicking on an existing entity still places a new one. Overlapping entities are allowed.
- Pulse is taken from the **snapped cursor position** (`$cursorPulse`), not the raw pointer Y.

### Post-Placement Editing

After placing a BPM change or time signature, a **centered Dialog** appears with a text field for the value. This is a deliberate simplification over inline/anchored popups:

- BPM: single number input
- Time signature: numerator / denominator inputs

The edit is a **separate undo action** (`EditEntityUserAction`), so the user can:

1. Undo the edit → reverts to default value
2. Undo again → removes the entity entirely

Notes do not trigger a popup — they are placed immediately with no further input.

### UserAction Classes

| Action                  | `do()`                                               | `undo()`                                         |
| ----------------------- | ---------------------------------------------------- | ------------------------------------------------ |
| `PlaceEntityUserAction` | Inserts entity, selects it, triggers popup info atom | Soft-deletes entity, restores previous selection |
| `EditEntityUserAction`  | Overwrites components with new values                | Restores previous component snapshot             |

Both capture `structuredClone` snapshots to prevent aliasing.

## Consequences

- **Extensible:** New column types only need a `placementHandler` — no changes to `handlePointerDown`.
- **Consistent undo model:** Placement and editing are separate actions, matching the "two undo actions" decision from the design review.
- **Simple UI:** Dialog-based editing avoids building a properties sidebar for this pass.
- **CRDT-safe:** New entities get fresh `uuidv7` IDs and versions. Edits bump the version.
- **Overlap allowed:** Multiple entities can exist at the same pulse in the same lane. Future work may add visual indicators for overlapping notes.

## Timing Engine Additions

Two new query methods were added to `TimingEngine` to support default-value placement:

- `getBpmAtPulse(pulse: number): number` — returns the active BPM at any pulse
- `getTimeSignatureAtPulse(pulse: number): TimeSignature` — returns the active time signature at any pulse

These use the precomputed `bpmSegments` and `effectiveSigs` arrays with binary search.

## References

- `src/packlets/editor-core/index.ts` — `$activeTool`, `placementHandler`, `PlaceEntityUserAction`, `EditEntityUserAction`, pencil-mode `handlePointerDown`
- `src/packlets/editor-core/index.test.ts` — acceptance tests for note, BPM, and time-sig placement
- `src/packlets/project-view/index.tsx` — toolbar tool switching, BPM/time-sig edit dialogs
- `src/packlets/timing-engine/index.ts` — `getBpmAtPulse`, `getTimeSignatureAtPulse`
