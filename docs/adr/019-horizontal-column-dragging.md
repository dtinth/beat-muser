# ADR 019: Horizontal Column Dragging

## Status

Accepted

## Context

ADR 013 implemented vertical-only event dragging (changing pulse position). The timeline has multiple column types (gameplay lanes, sound lanes, timing columns) and users need to move events between columns horizontally — changing a note's assigned lane/level or a sound event's sound lane.

The existing drag infrastructure (DragSlice, PointerInteractionSlice, ghost rendering) handles only Y-axis (pulse) changes. Extending it to support X-axis (column) changes required resolving several design questions about multi-selection behavior, cross-column-type boundaries, threshold detection, and component updates.

We considered and rejected alternatives:

- **Snap-to-column (absolute)**: cursor determines target column; all entities go there. Rejected because it loses relative positioning in multi-selection.
- **Separate horizontal drag state machine**: parallel Y and X trackers. Rejected in favor of a unified drag state.
- **Y-only threshold**: 5px vertical movement required. Rejected in favor of Euclidean distance to support pure horizontal lane changes.

## Decision

### 1. Relative Offset via Column Flat List

A **column flat list** is computed from all gameplay columns (level+lane pairs) and sound columns respectively. Each gameplay visible level contributes its game mode's lanes in order. Sound columns contribute their indices. Timing columns and spacers are excluded.

```
Gameplay flat list: [ (level1,8), (level1,1), (level1,2), ..., (level2,8), (level2,1), ... ]
Sound flat list:    [ 0, 1, 2, ..., N-1 ]
```

During a drag, the horizontal movement is expressed as a single **delta column index** — the difference between the cursor's target flat-list index and the anchor entity's original flat-list index. This delta is applied uniformly to all entities sharing the anchor's **drag affinity**.

### 2. Offset Clamping (Not Individual Clamping)

The delta column index is clamped so that the entire selection's horizontal range fits within the flat list bounds. Example:

- Selection covers flat-list indices 2–11 (range = 9)
- Max index = 13, so max offset = +2 (13 − 11)
- Min index = 0, so min offset = −2 (0 − 2)

The anchor entity may not land exactly on the cursor's target column if the selection hits the boundary. This is acceptable — the user sees all entities move and understands the constraint.

### 3. Drag Affinity

Each entity has a **drag affinity** determined by its type:

- **Notes** → `"gameplay"` affinity
- **Sound events** → `"sound"` affinity
- **Timing events** (BPM, TimeSig) → no affinity (never move horizontally)

When a multi-selection contains entities with different affinities, only those matching the **anchor's** affinity move horizontally. Others move vertically only.

For example: a selection containing both a note and a sound event. If the anchor is the note, only the note moves horizontally; the sound event moves only vertically, and vice versa.

### 4. Unified Drag State

The DragSlice is extended to store both Y and X drag state:

```
state:
  mode: "idle" | "pending" | "dragging"
  startViewportX, startViewportY
  originalPulses: Map<entityId, pulse>
  originalColumnIndices: Map<entityId, flatListIndex>
  startPulse, startColumnIndex
  deltaPulse, deltaColumnIndex
  affinity: "gameplay" | "sound" | null
```

### 5. Euclidean Drag Threshold

The 5px threshold to enter `"dragging"` mode uses Euclidean distance from the start point: `√(dx² + dy²) >= 5`. This enables lane-only changes where the user drags left/right with minimal vertical movement.

### 6. Ghost Rendering

Ghosts during a drag render at:

- The target column: `originalColumnIndex + deltaColumnIndex` mapped back to a `TimelineColumn`
- The target pulse: `originalPulse + deltaPulse` (same as before)

Originals remain at original position at 30% opacity. Ghosts render at 50% opacity in the target column.

### 7. Commit — Component Updates

On pointer up (if deltaColumnIndex !== 0):

| Entity type | Components updated                                           | Source → Target        |
| ----------- | ------------------------------------------------------------ | ---------------------- |
| Note        | `NOTE.lane` ← `laneIndex`<br>`LEVEL_REF.levelId` ← `levelId` | Target column's fields |
| Sound event | `SOUND_EVENT.soundLane` ← `soundLane`                        | Target column's field  |

Additionally, if a sound event is moved to a different sound lane, any notes with `KEYSOUND.soundLane` matching the old lane **at the same pulse position** are updated to the new lane index. This prevents keysound breakage.

### 8. Neutral Column Zones

When the cursor is over an incompatible column type (e.g., a sound column or spacer during a gameplay drag), the horizontal position is **sticky**: the last valid flat-list column the cursor passed over is retained. Horizontal offset doesn't change until the cursor re-enters compatible territory.

## Consequences

### Positive

- Familiar interaction for users: multi-selection maintains relative positioning.
- No data loss: keysound references auto-update on sound event moves.
- Predictable threshold: Euclidean distance works for both vertical-only and horizontal-only drags.
- Unified state machine keeps the drag logic in one place.

### Negative / Risks

- Column flat list must be computed in a shareable way (accessible by PointerInteractionSlice, DragSlice, RenderSlice).
- Sticky column behavior during neutral zones may feel slightly laggy if the user quickly zig-zags across domains.
- Keysound auto-update is a narrow heuristic (same-pulse match); edge cases (multiple keysounded notes at same pulse) need manual resolution.

## References

- `src/packlets/editor-core/slices/drag-slice.ts` — extended with column tracking
- `src/packlets/editor-core/slices/pointer-interaction-slice.ts` — maps viewport X to flat-list index
- `src/packlets/editor-core/slices/render-slice.ts` — ghost rendering in target columns
- `src/packlets/editor-core/slices/columns-slice.ts` — source of column data for flat list
- `CONTEXT.md` — Resolved design — Horizontal column dragging section
- `docs/adr/013-event-dragging-interaction-model.md` — base dragging interaction model
