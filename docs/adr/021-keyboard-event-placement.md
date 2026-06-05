# ADR 021: Keyboard Event Placement

**Status:** Accepted

**Date:** 2026-06-05

**Deciders:** dtinth, OpenCode

---

## Context

The editor currently places events using the Pencil tool (`W`) + mouse click on a timeline column. This requires the user to reach for the mouse for every event, which is slow for rhythm game charting where many events are placed in sequence.

We considered several approaches for keyboard-based event placement:

1. **Per-lane dedicated keys** (e.g., `D`/`F`/`J`/`K` for a 4-key layout) — fastest for gameplay lanes but doesn't scale to arbitrary game modes, sound lanes, or timing columns. Also breaks when game modes change.

2. **Column cursor + placement key** — a navigable column cursor (Left/Right + mouse hover) plus a single placement key. Generalizes to all column types and game modes.

3. **Tab through columns** — similar to column cursor but uses Tab/Shift+Tab. Lacks direct mouse override and feels less discoverable.

We chose option 2 because it's mode-agnostic, works with mouse as a fallback, and extends naturally to any column type (gameplay lanes, sound lanes, BPM, time-sig, soflan).

## Decision

### Cursor System

The editor now has two orthogonal cursors:

| Cursor            | Axis         | Navigation                                | Store                                    |
| ----------------- | ------------ | ----------------------------------------- | ---------------------------------------- |
| **Row cursor**    | Pulse (time) | ArrowUp / ArrowDown (snap grid, existing) | `$cursorPulse` in `CursorSlice`          |
| **Column cursor** | Column index | ArrowLeft / ArrowRight + mouse hover      | `$cursorColumnId` (new) in `CursorSlice` |

### Column Cursor Behavior

- **Mouse hover** over the timeline sets the column cursor to the column under the pointer. This overrides any keyboard-set position.
- **ArrowLeft/ArrowRight** navigate a filtered list of columns that have a `placementHandler`. Columns without placement support (measure column, spacers) are skipped.
- **No wrapping**: navigating past the first or last placeable column clamps at that column. From the inactive state (-1), ArrowRight moves to the first placeable column; ArrowLeft stays at -1.
- **Default**: `null` (inactive). Becomes active on first timeline hover or ArrowLeft/ArrowRight press.
- **Persistence**: the column cursor persists until page reload. If the stored column ID no longer exists in the placeable columns list, it reverts to inactive.

### Placement Key

- **Key**: `W`
- **Behavior**: If the Pencil tool is already active (`$activeTool === "pencil"`), pressing `W` places an event at the intersection of the row cursor pulse and the column cursor's column using the column's `placementHandler`. If the Pencil tool is not active, `W` activates it (existing behavior).
- **Guards**:
  - No-op if column cursor is inactive (null)
  - No-op during playback (chart is read-only when `$transportState === "playing"`)
  - No-op if the column's `placementHandler` returns null (e.g., sound lane with no selected channel)
- **Post-placement dialogs**: Same as mouse placement — BPM/time-sig/soflan events trigger the edit dialog after placement.

### Tool Scope

The column cursor exists in all tool modes (select, pencil, erase, pan). Keyboard-based event placement is initially scoped to the Pencil tool only.

### Rendering

A **column cursor indicator** is rendered as an upward-pointing triangle below the active column, using a `<div>` with `clip-path: polygon(...)` in the scrollable canvas render pipeline. It is a `"column-cursor"` type render spec produced by the RenderSlice.

## Consequences

### Positive

- **Mode-agnostic**: works with any game mode, any column type
- **Unified interaction**: mouse hover and keyboard navigation share the same cursor
- **Discoverable**: the triangle indicator provides visual feedback
- **Extensible**: future tools (erase, select) can reuse the column cursor
- **Backward compatible**: mouse-only users see no change

### Negative / Risks

- **Two-step placement** (navigate + press) is slower than per-lane keys for single-lane patterns
- **Column cursor state** adds complexity to cursor management (inactive state, column ID validity)
- **W key dual function** (toggle pencil / place) may confuse users who expect distinct keys for each action

## Alternatives Considered

### Per-Lane Dedicated Keys

Rejected because game modes have varying lane counts and layouts. A 4-key game mode would need `D`/`F`/`J`/`K`, but a 7-key mode would need more keys. Sound lanes and timing columns don't map to natural keyboard positions. This approach also requires per-extension configuration.

### Tab/Shift+Tab Navigation

Rejected because Tab is commonly used for focus management in web apps. The ArrowLeft/ArrowRight mapping is more intuitive and consistent with ArrowUp/ArrowDown.

## Related Code

- `src/packlets/editor-core/slices/cursor-slice.ts` — `$cursorPulse`, `$cursorColumnId`
- `src/packlets/editor-core/slices/view-command-slice.ts` — `navigateSnap`, new `navigateColumn`
- `src/packlets/editor-core/slices/pointer-interaction-slice.ts` — `handlePointerMove` updates column cursor
- `src/packlets/editor-core/slices/render-slice.ts` — produces `"column-cursor"` render spec
- `src/packlets/project-view/timeline-behavior.ts` — `"column-cursor"` renderer
- `src/packlets/project-view/index.tsx` — keyboard shortcuts for navigation and placement

## See Also

- **ADR 009: Note Placement with Pencil Tool** — original column-driven placement via mouse
- **ADR 006: Keyboard Shortcut System** — tinykeys-based shortcut infrastructure
- `CONTEXT.md` — `## Added terms — Keyboard event placement`
