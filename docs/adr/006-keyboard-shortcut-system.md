# ADR 006: Keyboard Shortcut System

**Status:** Accepted

**Date:** 2026-04-25

**Deciders:** dtinth, OpenCode

---

## Context

The editor needs keyboard shortcuts for commands like zoom, play/pause, undo/redo. The command registry (ADR 003) stores commands with metadata, but nothing was listening for keyboard events.

## Decision

### Library: tinykeys

We use `tinykeys` (~650B) for keyboard shortcut parsing and handling. It supports:

- `$mod` alias: Meta on macOS, Control on Windows/Linux
- Key sequences (e.g., `"g i"` for "go to inbox")
- `parseKeybinding()` for displaying shortcuts in UI
- Returns an unsubscribe function

Alternatives considered:

- **Custom handler** — ~50 lines but would miss edge cases (AltGraph, international keyboards)
- **hotkeys-js** — Larger, no `$mod` alias
- **mousetrap** — Unmaintained

### Platform-Specific Shortcuts

The `Command` interface has two optional shortcut fields:

```ts
interface Command {
  id: string;
  title: string;
  shortcut?: string; // Default / Windows/Linux
  shortcutMac?: string; // macOS override
  execute: () => void;
}
```

`$mod` handles the common case (Ctrl/Cmd) cross-platform. `shortcutMac` is an escape hatch for genuinely different shortcuts, not just modifier-swapped ones.

### KeyboardShortcutHandler

A standalone class in the `command-registry` packlet:

```ts
new KeyboardShortcutHandler({ registry: globalCommandRegistry });
```

- Subscribes to `CommandRegistry` change events
- Rebuilds `tinykeys` bindings automatically when commands are registered/unregistered
- Detects platform via `navigator.platform.includes("Mac")`
- Calls `event.preventDefault()` before executing commands

### No-Modifier Zoom

Zoom is a frequent operation, so zoom in/out use `Equal` and `Minus` keys without modifiers:

```ts
commands.add({
  id: "zoomIn",
  title: "Zoom In",
  shortcut: "Equal",
  execute: () => controller.zoomIn(),
});
commands.add({
  id: "zoomOut",
  title: "Zoom Out",
  shortcut: "Minus",
  execute: () => controller.zoomOut(),
});
```

### No Dynamic On-the-Fly Registration

`tinykeys` does not support adding bindings after creation. The handler unsubscribes the old listener and creates a new one whenever the registry changes. This is acceptable since command changes are rare (only at mount/unmount time currently).

## Consequences

### Positive

- Cross-platform shortcuts work out of the box via `$mod`
- macOS-specific overrides possible via `shortcutMac`
- Automatic rebinding when commands change
- No modifier keys for zoom = faster workflow

### Negative / Risks

- `tinykeys` does not ship TypeScript declarations; we maintain `src/types/tinykeys.d.ts`
- Rebuilding bindings on every registry change is slightly inefficient, but negligible for our scale
- `navigator.platform` detection is simple but may fail on iPads or future platforms

## Related Code

- `src/packlets/command-registry/index.ts` — `CommandRegistry`, `CommandSet`, `KeyboardShortcutHandler`
- `src/types/tinykeys.d.ts` — Type declarations for tinykeys
- `src/packlets/project-view/index.tsx` — Command registration and handler instantiation

## See Also

- **ADR 003: EditorController Outbox Pattern** — Command system architecture
- **ADR 004: Event Emitter Library Choice** — Why nanoevents is used for registry change notifications
