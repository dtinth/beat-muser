# ADR 013: Event Dragging Interaction Model

## Status

Accepted

## Context

The editor needs a way to move events (notes, BPM changes, time signatures, sound events) on the timeline after they have been placed. The timeline already supports selection (single, multi, box-select) and tool-based editing (pencil, erase). Dragging is the remaining core authoring interaction.

We considered several models for how dragging should work, especially in relation to selection and multi-selection. The decisions below were reached through a `/grill-me` session that walked through the design tree branch by branch.

## Decision 1: Clicking a Selected Event Preserves the Selection

### Problem

When multiple events are selected and the user clicks on one of them, the intuitive expectation is either:

- **(A)** Clear the selection and select only the clicked event (common in web apps)
- **(B)** Preserve the selection and prepare to move all selected events (standard in DAWs and rhythm game editors)

### Decision

**(B)** Clicking any event that is **already in the current selection** preserves the entire selection and enters a drag-pending state. The selection is only replaced if the clicked event was **not** selected.

### Rationale

- This matches FL Studio, Ableton Live, and osu!mania editors. Users learn that clicking a selected note means "I'm about to move these."
- Prevents the frustrating UX of losing a carefully-built multi-selection just because you clicked on one of the selected items to drag it.
- Shift+click still toggles individual items in/out of the selection, but only on **unselected** items. Toggling off a selected item via Shift+click works if the user intends to deselect before dragging — but if they then drag, the now-deselected item is no longer part of the drag set. This is acceptable because the explicit toggle signals intent.

## Decision 2: Drag Threshold (5px)

### Problem

A plain click on an event should not immediately start a drag. If the user clicks and releases without moving, it should be treated as a selection click (already handled at `pointerdown`). If the user moves the mouse even a tiny amount (e.g., 1px), it's ambiguous whether they intended a drag or just shaky hands.

### Decision

A **5-pixel drag threshold** is required before transitioning from `DRAG_PENDING` to `DRAGGING`. If the user releases the mouse before crossing this threshold, no drag action is created.

### Rationale

- 5px is large enough to distinguish intentional drags from accidental micro-movements, but small enough that it doesn't feel sluggish.
- During `DRAG_PENDING`, the cursor/playhead continues to follow the mouse normally. Only after crossing into `DRAGGING` do we start rendering ghosts and suppress other interactions.
- This matches virtually every professional editor (Figma, Photoshop, DAWs).

## Decision 3: Ghost Preview Instead of Direct Move

### Problem

During a drag, should the original events move in real-time, or should semi-transparent "ghost" copies follow the mouse while the originals stay at their positions?

### Decision

Use **ghost preview**: the original events stay at their original positions (dimmed to 30% opacity), and semi-transparent ghost copies (50% opacity) follow the snapped mouse position.

### Rationale

- Ghost preview provides better visual feedback. The user can always see both the original and target positions, making it easier to align precisely.
- It avoids the visual jarring of events jumping around during drag — especially important when dragging multiple events simultaneously.
- Standard in DAWs and professional design tools.
- Implementation requires adding `opacity` support to `RenderObject`, which is a small, clean change.

## Decision 4: Vertical-Only in First Iteration

### Problem

Should the first implementation of dragging allow moving events between lanes/columns (horizontal), or only change their pulse position (vertical)?

### Decision

**Vertical-only.** All selected events move by the same delta pulse. Lane/column changes are deferred to a future iteration.

### Rationale

- Vertical movement is the most common operation (adjusting timing).
- Horizontal movement (changing lanes) has additional constraints: a note dragged to a different lane type doesn't make sense (e.g., a BPM change in a gameplay lane). We'd need type-aware constraints.
- Keeping the first iteration simple lets us validate the core drag mechanics (threshold, ghosts, snapping, undo) before adding complexity.

## Decision 5: Delta Clamping to Prevent Negative Pulse

### Problem

If the user drags events downward (toward the start of the song), they could drag past pulse 0 into negative territory, which is invalid.

### Decision

The drag delta is **clamped** so that no selected event ends up at a negative pulse. If the lowest selected event is at pulse 60 and the user drags down by 120, the effective delta is clamped to -60.

### Rationale

- Prevents invalid state (negative pulse) from ever being created.
- The clamping happens during the drag preview, so the user sees exactly where the events will land.
- Standard behavior in all timeline-based editors.

## Decision 6: Batch Undo Action for Drag Commit

### Problem

When dragging 50 selected notes, should the undo system create one action per note or one action for the entire drag?

### Decision

A single **batch action** (`BatchEditEntitiesUserAction`) is created on `pointerup`. Undoing reverts all moved events simultaneously.

### Rationale

- A drag is conceptually one user operation. Undoing should revert the entire operation, not force the user to undo 50 times.
- Keeps the history stack clean and predictable.
- If delta is 0 (click and release without moving), no action is created at all.

## State Machine

The pointer interaction uses a mutually-exclusive state machine:

```
IDLE ──pointerdown on selected event──► DRAG_PENDING
  │                                      │
  │                                      │ move ≥ 5px
  │                                      ▼
  │                                   DRAGGING
  │                                      │
  │                                      │ pointerup
  │                                      ▼
  │                                   commit batch action
  │                                      │
  └──────────────────────────────────────┘
         (return to IDLE)

IDLE ──pointerdown on empty space────► BOX_SELECTING
  │                                      │
  │                                      │ pointerup
  │                                      ▼
  │                                   finalize selection
  │                                      │
  └──────────────────────────────────────┘
         (return to IDLE)
```

States are mutually exclusive: entering drag cancels box select and vice versa.

## Consequences

### Positive

- Familiar interaction model for users coming from DAWs and rhythm game editors.
- Selection is preserved during drags, reducing accidental data loss.
- Ghost preview provides clear visual feedback for multi-selection drags.
- Batch undo keeps the history stack clean.
- Vertical-only first iteration is simple to implement and test.

### Negative / Risks

- Ghost preview requires `opacity` support in `RenderObject` and `TimelineRenderSpec`.
- The drag state machine adds complexity to `PointerInteractionSlice`.
- Selection preservation behavior may surprise web-app users (though it's standard in creative tools).

## References

- `src/packlets/editor-core/slices/pointer-interaction-slice.ts` — drag state machine and pointer handling
- `src/packlets/editor-core/slices/render-slice.ts` — ghost rendering via opacity
- `src/packlets/editor-core/user-actions.ts` — `BatchEditEntitiesUserAction`
- `src/packlets/scrollable-canvas/index.tsx` — `RenderObject` with `opacity` support
- `docs/adr/001-chart-timeline-view.md` — timeline view architecture
- `docs/adr/009-note-placement-with-pencil-tool.md` — tool system and placement handlers
