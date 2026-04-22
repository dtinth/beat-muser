# ADR 001: Chart Timeline View Architecture

**Status:** Accepted

**Date:** 2026-04-22

**Deciders:** dtinth, OpenCode (via /grill-me session)

---

## ⚠️ Temporary Artifact — To Be Removed After Implementation

> **This ADR exists because the code does not yet exist.** Its sole purpose is to serve as a reference during implementation. Once the timeline view is built, the source code itself must be self-explanatory.
>
> **When implementing:** Document subtleties, edge cases, and non-obvious behavior directly in code comments, JSDoc, and variable names. A reader should understand the system by reading the code and its inline documentation — they should not need to read this ADR.
>
> **After implementation:** This file should be deleted. If architectural context is still needed, it should live in the relevant packlet's `@packageDocumentation` comment or in a short README next to the code, not in a separate ADR.

---

## Context

Beat Muser is a rhythm game notechart/beatmap editor. The editor page currently has a full UI shell (toolbar, sidebars, layout) but the central timeline area is a placeholder. This ADR records the architectural decisions made for implementing the chart timeline view where objects are placed, rendered, selected, and edited.

The session used the `/grill-me` methodology: walking down each branch of the design tree, resolving dependencies between decisions one-by-one.

---

## Decision 1: Rendering Technology — Virtual DOM in Scrollable Container

### Question

The timeline must render hundreds to thousands of objects (note markers, beat/measure lines, playhead, lane dividers, background grid) and update at 60fps during scroll, zoom, and playback. Should we use Canvas 2D, SVG, DOM divs, or a hybrid?

### Options Considered

- **A. Canvas 2D** — Best performance for many objects, harder for accessibility, need custom hit-testing.
- **B. SVG** — DOM-based, easier event handling, can struggle with thousands of nodes.
- **C. DOM (divs/CSS)** — Simplest event handling, React-friendly, poor performance beyond a few hundred nodes without virtualization.
- **D. Hybrid** (Canvas for grid/notes, DOM overlay for UI) — Performance + React ergonomics.

### Decision

**C with virtualization.** We use a native `overflow: auto` scrollable container with virtual rendering. Only objects in the visible viewport (plus a buffer) are real DOM nodes. The browser handles trackpads, wheel events, touch, and momentum scrolling for free.

### Rationale

- Native scrolling UX is superior to custom wheel interception (momentum, trackpad gestures, accessibility).
- Virtualization eliminates the DOM performance bottleneck.
- 1000s of objects may exist in the chart, but only a small fraction are visible at once.

---

## Decision 2: Timeline Orientation — Vertical, Bottom = Start

### Question

Should time flow downward (top = end, bottom = start) or upward (top = start, bottom = end)? Should we use horizontal time like a DAW?

### Options Considered

- **A. Vertical scrolling, top = end, bottom = start** — Standard for falling-notes VSRG. Notes fall downward toward a judgment line.
- **B. Horizontal scrolling** — Standard for DAWs/piano rolls.

### Decision

**A.** Vertical timeline. Start of song is at the **bottom**. End of song is at the **top**. Notes fall downward.

### Rationale

- The application is a VSRG (Vertical Scrolling Rhythm Game) editor where notes fall down.
- This is the convention in rhythm game editors (StepMania, osu!mania, BMS editors).

---

## Decision 3: Coordinate System — Top-Based Absolute Positioning

### Question

With bottom = start, should we position elements using `bottom` (anchored to bottom edge) or `top` (anchored to top edge)?

### Options Considered

- **A. `bottom` positioning** — Elements anchored to bottom edge. `bottom = pulse * scale`. Natural for bottom-origin.
- **B. `top` positioning** — Elements anchored to top edge. `top = trackHeight - pulse * scale`. More conventional.

### Decision

**B. `top` positioning.**

### Rationale

- `top`-based positioning avoids coordinate flipping with mouse coordinates and hit-testing math.
- Hit-testing formula: `pulseY = (trackHeight - elementTop) / scale` — uniform, no special cases.
- When chart length extends, every element's `top` increases by `Δ * scale`, compensated by `scrollTop += Δ * scale` in the same frame (using `useLayoutEffect`) to prevent flicker.

### Math

```
trackHeight = chart.length * scale
elementTop = trackHeight - pulseY * scale
visibleTopY = (trackHeight - scrollTop - viewportHeight) / scale
visibleBottomY = (trackHeight - scrollTop) / scale
```

---

## Decision 4: PPQN — 240 (bmson Standard)

### Question

What should the Pulses Per Quarter Note be?

### Options Considered

- **A. 960** — Aligned with MIDI standard. Was the initial value.
- **B. 240** — bmson standard (960 ticks per measure / 4 beats = 240 per quarter note).

### Decision

**B. 240.**

### Rationale

- bmson is the de facto standard for web-based rhythm game chart formats.
- bmson specifies default PPQN = 240.
- The project schema, parser tests, and AGENTS.md were updated to reflect this.

---

## Decision 5: Base Scale and Zoom

### Question

How should zoom work?

### Decision

- **Base scale:** `0.2` px/pulse (fixed constant).
- **Zoom:** Multiplier on base scale. Stored in `EditorController` as `zoomMultiplier` (default `1.0` = 100%).
- **Effective scale:** `scale = 0.2 * zoomMultiplier`.
- **Zoom is vertical-only.** Horizontal scale is fixed at `1.0` for the MVP.

### Rationale

- Zoom as a multiplier keeps the base constant obvious and makes toolbar dropdown values (25%, 50%, 100%, 200%, 400%) map cleanly.
- Horizontal zoom is out of scope for MVP; fixed lane widths are simpler.

---

## Decision 6: Chart Length — Fixed with Auto-Extend

### Question

Should track height be derived from `maxEventY` (dynamic, causes shifting) or from a fixed chart length?

### Decision

**Fixed chart length.** The `chart` component has a `length: number` field (pulses). Default is `15360` (16 measures of 4/4 at 240 PPQN).

### Rationale

- If track height depends on `maxEventY`, every time a note is placed at the end, all existing notes shift down. Bad UX.
- Fixed length decouples track height from note data.
- When placing a note past the current end, auto-extend `chart.length` by some margin.
- Chart length extension is a model mutation that goes through `applyUserActions` and is undoable.

### Flicker Prevention

When `chart.length` increases by `Δ`:

1. Re-render → track height grows by `Δ * scale`.
2. `useLayoutEffect` fires, reads `scrollHeight`, computes `delta`, writes `scrollTop += delta`.
3. Browser paints → every object stays at the same pixel position. No flicker.

---

## Decision 7: Virtual Rendering — Pulse-Space Sections

### Question

How should the virtual window batch elements?

### Options Considered

- **A. Pixel-space sections** — e.g., every 256px of screen height. Section height constant, but notes hop between sections on zoom change.
- **B. Pulse-space sections** — e.g., every 1024 pulses. Note-to-section assignment is stable regardless of zoom.

### Decision

**B. Pulse-space sections of 1024 pulses each.**

### Rationale

- Stability: A note always belongs to the same section regardless of zoom. Only CSS heights change.
- At 100% zoom: ~205px per section. At 400% zoom: ~819px per section.
- With a ~800px viewport, 1–4 sections are visible at a time. Batches DOM work efficiently without over-rendering.
- Pulse-space sections align with the event-based data model.

### Section Size

- **1024 pulses per section.** This is ~4.3 beats at 4/4. Fine enough for responsive virtual rendering, coarse enough to batch work.

---

## Decision 8: Rendering Medium — Raw DOM Manipulation

### Question

Should we render sections via React, or use raw DOM manipulation?

### Decision

**Raw DOM manipulation inside a React container.** React provides the outer scrollable container via `ref`. The `TimelineRenderer` class subscribes to `$visibleRenderObjects` nanostore directly and mounts/unmounts DOM nodes imperatively.

### Rationale

- Bypassing React eliminates sync with React lifecycles for high-frequency updates (scroll, zoom).
- `onScroll` reads `scrollTop`, calls `controller.setScrollTop()`. Controller recomputes visible render objects and sets `$visibleRenderObjects` atom.
- React component subscribes to the nanostore via `useEffect` (not `useStore`), callback goes straight to the renderer. No React re-renders on scroll.

---

## Decision 9: Background Grid — Rendered Inside Sections

### Question

Should measure/beat lines and lane dividers be a separate CSS/canvas layer, or rendered inside virtual sections alongside notes?

### Decision

**Rendered inside pulse-space sections alongside notes.** Grid lines are DOM `<div>` elements within the same section containers as notes.

### Rationale

- The grid is **not regular** — it depends on time signature events and BPM changes. Measure boundaries are computed from timing data. Snap subdivisions depend on the current snap setting and time signature. A CSS gradient cannot express this.
- Grid lines are simple 1px or 2px strokes. With a 1024-pulse section, you might have ~10–20 grid lines. At 4 visible sections, that's ~80 divs. Negligible overhead.
- Using the same positioning system as notes keeps one virtual window system instead of two.

---

## Decision 10: Render Objects vs Entities

### Question

What is the relationship between ECS entities and what gets drawn?

### Decision

**Entities inform render objects. Render objects are a derived view optimized for display.**

### Rationale

- Multiple entities can contribute to one render object (e.g., a chain line connecting multiple events).
- One entity can spawn multiple render objects (e.g., a note marker + selection highlight).
- The editor core owns event selection. The mode plugin defines how events are rendered.
- This decouples the editor core from game-mode specifics.

### Render Object Structure

```ts
interface RenderObject {
  yStart: number; // Start pulse
  yEnd: number; // End pulse (for long notes, etc.)
  x: number; // Horizontal position (px, relative to track left)
  width: number; // Width in pixels
  type: string; // Visual type identifier
  color: string; // CSS color
  entityId?: string; // Associated event entity ID (for hit-testing)
  zIndex?: number;
  className?: string;
  style?: React.CSSProperties;
}
```

---

## Decision 11: Section Ownership for Spanning Objects

### Question

If a render object spans multiple sections, which section owns it?

### Decision

**A render object is owned by the section containing its `yStart`.** It is rendered as a child of that owner section, even if it visually extends into adjacent sections.

### Visibility Rule

A section is mounted if:

1. Its pulse range intersects the visible viewport range, **OR**
2. It owns render objects whose `[yStart, yEnd)` intersects the visible viewport range.

### Rationale

- One section per render object, no clipping at section boundaries.
- The render object is placed in its owner section with `top` and `height` that may extend beyond the section's pixel bounds. The scrollable container handles clipping.
- For the first implementation, a wide buffer (visible ± 2 sections) will handle most spanning objects. The behavior will be locked down with tests.

---

## Decision 12: Lane Rendering — Fixed Width, Absolute Positioning

### Question

How are lanes laid out?

### Decision

- **Fixed lane width** — each lane is a specific pixel width (e.g., 64px).
- **Absolute positioning** — lane backgrounds and note elements use `position: absolute` with computed `left` and `width`.
- **No browser layout** — do not depend on flexbox, grid, or any browser layout engine for lane positioning.
- **Horizontal scrolling** — if total lane width exceeds viewport, horizontal scroll is enabled (not virtualized).

### Rationale

- Each lane may have a different width.
- Some game modes have notes that span multiple lanes (e.g., Chunithm).
- Manual layout gives full control and makes hit-testing deterministic.
- `trackOffsetX` is computed in JS and added to every element's `left`. Centering is done manually: `trackOffsetX = (viewportWidth - trackWidth) / 2`.

---

## Decision 13: Event Rectangle Dimensions

### Question

What are the dimensions of the selectable event rectangle?

### Decision

- **Height:** Fixed 8px (in pixels, not pulses).
- **Width:** Determined by the mode plugin (e.g., lane width for lane-based notes, full track width for BPM changes).

### Rationale

- Events are the primary selectable units. They always render as a rectangle.
- Visual artifacts (chain lines, long note bodies) are derived from events and may not be selectable.
- Fixed pixel height ensures notes are always clickable regardless of zoom.

---

## Decision 14: Selection Model

### Question

What gets selected when the user clicks?

### Decision

**Events** (entities with an `event` component) are selected. Selection is a `Set<string>` of event entity IDs.

### Rationale

- Notes, chains, and holds are visual artifacts derived from events.
- The editor core manages event selection. The mode plugin decides how to render selected events (highlight color, handles, etc.).
- When clicking a chain line (a visual artifact), the mode plugin can optionally define which event(s) to select. But the core only tracks event IDs.

---

## Decision 15: Hit-Testing

### Question

Who is responsible for hit-testing?

### Decision

**The editor core handles all hit-testing.** The core knows exactly where each event is placed on the timeline.

### Rationale

- The core ingests render objects from the mode plugin and maintains a spatial index.
- The plugin says "draw this rectangle at (pulse, laneX)"; the core records that and can answer "what's under the mouse?"
- This keeps the mode plugin simple and stateless.

### Hit-Testing Math

```
localY = scrollTop + clientY - containerTop
pulseY = (trackHeight - localY) / scale
localX = clientX - containerLeft - trackOffsetX
```

### Tolerance

±4px tolerance around event center, capped at half the event height, to make notes easy to click at low zoom.

### Implementation

Start with a sorted array by pulse Y + linear scan. The interface must be clean and testable. Optimize the index later without changing behavior.

---

## Decision 16: Timing Engine

### Question

How should measure boundaries, snap points, and pulse-to-seconds conversion be computed?

### Decision

**A pure `TimingEngine` interface with testable functions.**

### Interface

```ts
interface BpmChange {
  pulse: number;
  bpm: number;
}
interface TimeSignature {
  pulse: number;
  numerator: number;
  denominator: number;
}

interface TimingEngine {
  getMeasureBoundaries(range: { start: number; end: number }): number[];
  getSnapPoints(snap: string, range: { start: number; end: number }): number[];
  pulseToSeconds(pulse: number): number;
  secondsToPulse(seconds: number): number;
}
```

### Key Behaviors

- **Time signature events interrupt the bar immediately.** A new measure starts at the exact pulse of the time signature event.
- **Implicit 4/4 at pulse 0** if no time signature event exists.
- **BPM changes are independent** from time signatures. Measure boundaries are determined solely by time signatures.
- **Snap grid is measure-relative.** Snap points reset at each measure boundary. The snap interval is fixed (based on editor setting), but the phase resets at each measure start.
- **Snap must divide a quarter note evenly.** Valid snaps: 1/4, 1/8, 1/12, 1/16, 1/20, etc. (any divisor of 240).

### Rationale

- Clean separation between timing logic and rendering.
- Linear search is acceptable for the first implementation.
- All logic is independently testable with plain arrays — no ECS coupling.

---

## Decision 17: Playhead Behavior

### Question

Where is the playhead during editing and playback?

### Decision

- **Edit mode:** The playhead follows the **mouse cursor**. Wherever the mouse points on the grid, that's the current cursor position in pulses.
- **Playback mode:** The playhead **locks to the viewport Y position where the mouse was when playback started**. The chart auto-scrolls to keep the current song time aligned with that fixed playhead position. Mouse movement is ignored during playback.

### Rationale

- Natural UX: the user implicitly chooses the judgment line position just by where they hover before pressing Play.
- During playback, the editor is view-only (except for future recording). Editing operations are disabled.

---

## Decision 18: State Management — EditorController + Nanostores

### Question

How should editor state be managed?

### Decision

**`EditorController` owns all editor state.** It is instantiated in the React Router loader and provided via React Context. React is a "dumb view layer."

### State Ownership

| State                    | Owner      | Reason                             |
| ------------------------ | ---------- | ---------------------------------- |
| Entity list / note data  | Controller | Model; saved to disk               |
| Scroll / zoom / snap     | Controller | Needed for viewport math           |
| Mouse / pointer position | Controller | Needed for hit-testing             |
| Active tool              | Controller | Other parts observe it             |
| Selection                | Controller | Model-adjacent; affects operations |
| Playback position        | Controller | Drives timeline rendering          |
| Panel open/closed        | React      | Pure chrome                        |
| Hover tooltip content    | React      | Ephemeral                          |

### Reactive Interface

The controller exposes nanostores. Key stores:

- `$zoom` — atom, subscribed by toolbar
- `$activeTool` — atom, subscribed by toolbar
- `$selection` — map/set, subscribed by properties panel
- `$playbackPosition` — atom, subscribed by transport display
- `$visibleRenderObjects` — atom/computed, subscribed by timeline renderer

### Rationale

- `$visibleRenderObjects` is the **single bridge** between controller and timeline renderer.
- The timeline renderer subscribes to this nanostore directly (via `useEffect` callback, not `useStore`) to avoid React re-renders on scroll.

---

## Decision 19: Tools

### Question

What tools should the editor have?

### Decision

Four separate toolbar tools:

- **Select** — Click to select event. Shift+click multi-select. Drag to box-select. Drag selected events to move.
- **Pencil** — Click empty space to place a note at snapped position. Drag to create long notes.
- **Erase** — Click an event to delete it.
- **Pan** — Click-drag anywhere to scroll the view.

### Rationale

- Explicit tools match convention in rhythm game editors and DAWs.
- Middle-mouse or Space+drag can also pan as a shortcut regardless of active tool.

---

## Decision 20: Zoom Control

### Question

How does the user control zoom?

### Decision

- **Discrete presets** via toolbar dropdown: `["25%", "50%", "75%", "100%", "125%", "150%", "200%", "400%"]`.
- **Keyboard shortcuts**: Ctrl++/Ctrl+- adjust by preset steps, Ctrl+0 resets.
- **Vertical-only.** No horizontal zoom UI for MVP.

### Rationale

- Presets are easier to reason about and test than continuous zoom.
- Power users need keyboard shortcuts.

---

## Decision 21: Mode Plugin Architecture (Future)

### Question

How will game modes define their rendering?

### Decision

**Deferred to post-MVP.** For the MVP, we will hardcode a simple 4k lane renderer.

### Future Vision

- Plugins are URLs loaded in iframes that communicate with the parent window to register game modes.
- The editor provides primitives: events are always rendered as rectangles. Plugins can adjust the rectangle's x position, size, color, or text label via a declarative API (expression syntax, logic data structure, or hardened ECMAScript compartments).
- Plugins receive a list of events and push extra render objects (lines, text labels) to visualize chains, holds, etc. Similar to VS Code's `TextEditorDecorationType`.
- The editor core handles the actual DOM placement and lifecycle.

### Rationale

- The immediate goal is to make the timeline render something so we can iterate.
- The architecture (render objects, absolute positioning, mode-agnostic core) is designed to accommodate this plugin system later.

---

## Decision 22: Time Signature in Schema

### Question

Should time signature be a first-class ECS component?

### Decision

**Yes.** Add `TimeSignatureComponentSchema` to `schema.ts`:

```ts
export const TimeSignatureComponentSchema = Type.Object(
  {
    numerator: Type.Number(),
    denominator: Type.Number(),
  },
  { additionalProperties: false },
);
```

Also extend `ChartComponentSchema` with `length: number` (default 15360 pulses).

### Rationale

- Time signature is core to measure boundaries and snap grid behavior, not optional.
- Chart length is required for the fixed-track-height design.

---

## Decision 23: New Components / Schema Extensions

### Changes Made

1. **PPQN changed from 960 to 240** across `AGENTS.md`, `schema.ts`, and `parser.test.ts`.
2. **`TimeSignatureComponentSchema`** will be added to `schema.ts`.
3. **`ChartComponentSchema.length`** will be added (default 15360).
4. **`measure` entity** is NOT needed — measures are purely derived from time signatures + pulses.

---

## Consequences

### Positive

- Native browser scrolling gives excellent UX (trackpads, momentum, accessibility).
- Virtual rendering with pulse-space sections scales to large charts.
- Top-based absolute positioning simplifies hit-testing math.
- Fixed chart length prevents note shifting on extension.
- TimingEngine is fully testable and decoupled from rendering.
- Mode-agnostic core allows future plugin architecture.
- Raw DOM manipulation gives 60fps performance.

### Negative / Risks

- Raw DOM manipulation bypasses React's reconciliation — potential for DOM/React state mismatch if not careful.
- Need to manually handle scroll compensation on chart length extension.
- Hit-testing with linear search may need optimization for very dense charts.
- Wide section buffers may over-render spanning objects.
- No Canvas fallback for extremely dense charts (can be added later).

### Neutral

- Horizontal scrolling is non-virtualized (acceptable since lane counts are bounded).
- Plugin architecture is deferred; 4k hardcode is temporary.

---

## References

- `src/packlets/project-format/schema.ts` — ECS schema definitions
- `src/packlets/editor-core/index.ts` — EditorController design document
- `src/packlets/project-layout/index.tsx` — Layout shell
- `src/packlets/project-view/index.tsx` — Current mock UI
- `AGENTS.md` — Project conventions and commands

---

## Notes

- All behavior will be locked down with tests. Implementation can be optimized (e.g., spatial index for hit-testing, inverted index for spanning objects) without changing externally observable behavior.
- The snap dropdown in the current toolbar mock (`["1/1", "1/2", ..."]`) will need updating to only include values that evenly divide a quarter note (240 pulses).
