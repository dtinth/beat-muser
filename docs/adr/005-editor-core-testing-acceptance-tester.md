# ADR 005: Editor Core Testing — Acceptance Tests via Fluent Tester

**Status:** Accepted

**Date:** 2026-04-25

**Deciders:** dtinth, OpenCode

---

## Context

The `EditorController` is a complex state machine that owns scroll position, zoom, viewport size, cursor tracking, and visible render specs. Initially, tests called controller methods directly and asserted on atom values:

```ts
const controller = new EditorController({ project });
controller.setZoom(2);
controller.setScrollTop(100);
expect(controller.$visibleRenderObjects.get()).toHaveLength(42);
```

This was fragile and unreadable. Tests knew implementation details (which atoms to read, how scroll math works) and did not read like user scenarios.

## Decision

**Acceptance-test style via `EditorTester`.** Tests simulate user-level interactions and assert on observable outcomes.

### `EditorTester`

A test helper that wraps `EditorController` and provides a fluent API:

```ts
const editor = EditorTester.create();
editor.hover(100, 50);
editor.zoomTo(2);
editor.scrollTo(100);
editor.playhead.shouldBeAtPulse(2560);
```

### Fluent Assertions

Assertions are organized by domain, not by atom name:

- `editor.playhead.shouldBeAtPulse(n)` — Where is the playhead?
- `editor.playhead.shouldBeAtViewportY(y)` — Is it visible at the right screen position?
- `editor.columns.shouldHaveCount(n)` — How many timeline columns?
- `editor.timing.shouldHaveBpmAtPulse(pulse, bpm)` — What BPM is at this pulse?

### Builder Pattern for Test Data

Test fixtures use builders for readable setup:

```ts
const project = new ProjectBuilder()
  .addChart((chart) => {
    chart.setSize(15360);
    chart.addBpmChange({ pulse: 0, bpm: 120 });
    chart.addTimeSignature({ pulse: 0, numerator: 4, denominator: 4 });
    chart.addLevel("beat-7k", (level) => {
      level.addNote({ pulse: 2560, lane: 0 });
    });
  })
  .build();
```

Builders:

- `ProjectBuilder` — Creates a `ProjectFile` with charts, levels, and entities
- `ChartBuilder` — Configures a chart and its child entities
- `EntityBuilder` — Generic ECS entity builder with `.with(component, data)`

### Colocation

`EditorTester` and the builders live in `src/packlets/editor-core/tester.ts`, alongside the code they test. Tests import from `./tester`.

## Rules

1. **Tests do not import `EditorController` directly.** They import `EditorTester`.
2. **Tests do not read atoms directly.** They use `EditorTester` assertion methods.
3. **Tests do not call controller methods directly.** They use `EditorTester` interaction methods (`hover`, `zoomTo`, `scrollTo`).
4. **Builder methods must actually mutate the project.** `addChart` inserts into the entities array; `addNote` creates an entity with `NOTE`, `EVENT`, and `LEVEL_REF` components.

## Consequences

### Positive

- Tests read like user scenarios. `hover` → `zoomTo` → `scrollTo` → `shouldBeAtPulse` tells a story.
- Refactoring the controller does not break tests as long as the tester API stays stable.
- New contributors (and AI agents) can write tests without understanding nanostores atoms or scroll math.

### Negative / Risks

- `EditorTester` is extra code to maintain. If the controller API changes, the tester must be updated first.
- Builders hide the underlying entity structure. A test author might not realize what components an `addNote` call creates.
- Slightly more indirection when debugging a failing test.

## Related Code

- `src/packlets/editor-core/tester.ts` — `EditorTester`, `ProjectBuilder`, `EntityBuilder`, `ChartBuilder`
- `src/packlets/editor-core/index.test.ts` — Example tests using the fluent API
