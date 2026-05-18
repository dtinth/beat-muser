# ADR 020: Extension Architecture

**Status:** Accepted

**Date:** 2026-05-18

---

## Context

Game mode registration cannot remain purely declarative — the "touch" mode scenario requires custom entity components (`fingerId`), custom rendering (drag lines between events), and custom commands (export to game format). ADR 014 established a `GameModeRegistrySlice` as the extension point, but deferred _how_ extensions register. This ADR defines the full extension system.

## Decision

### Terminology

Use **extension** (not plugin). This avoids confusion with the browser extension concept and aligns with VS Code's mental model.

### Extension package

An extension is a ZIP file (or fetched URL) containing at minimum:

```
extension.json       — manifest (JSON)
worker.js            — runtime code (Web Worker)
```

### Manifest (`extension.json`)

The manifest is purely declarative. It declares what the extension contributes to the editor; no executable code.

```jsonc
{
  "$schema": "https://beat-muser.pages.dev/schemas/extension.schema.json",
  "id": "com.example.touch",
  "name": "Touch Mode",
  "version": "1.0.0",
  "gameModes": [
    {
      "mode": "touch-2k",
      "lanes": [
        { "laneIndex": 0, "name": "L", "width": 80, "noteColor": "#ef4444" },
        { "laneIndex": 1, "name": "R", "width": 80, "noteColor": "#3b82f6" },
      ],
    },
  ],
  "components": {
    "fingerId": {
      "type": "number",
      "description": "Which finger (0-4)",
    },
    "drag": {
      "type": "object",
      "properties": {
        "previousEventId": { "type": "string" },
      },
    },
  },
  "commands": [
    {
      "id": "com.example.touch.export",
      "title": "Export to Game",
    },
  ],
  "exporters": [
    {
      "id": "com.example.touch.exporter",
      "gameModes": ["touch-4k", "touch-5k", "touch-6k", "touch-7k", "touch-8k", "touch-9k"],
      "commandId": "com.example.touch.export",
    },
  ],
}
```

Fields:

- **`gameModes`** — lane layouts contributed, registered via `GameModeRegistrySlice`
- **`components`** — schemas for new entity components the extension uses. Editor stores them as-is (`additionalProperties: true` already allows this) and uses schemas to drive the inspector UI.
- **`commands`** — commands the extension handles. Registered in the global `CommandRegistry`. No `shortcut` field here — shortcuts are user-configurable, future.
- **`exporters`** — declarative mapping from game modes to commands. When a project containing a matching level is saved, the editor triggers the command.

### Extension interface

All extensions implement a common interface, whether built-in or worker-based:

```typescript
interface Extension {
  readonly manifest: ExtensionManifest;
  connect(host: ExtensionHost): void;
}

interface ExtensionManifest {
  id: string;
  name: string;
  version: string;
}

interface ExtensionHost {
  registerGameMode(layout: GameModeLayout): void;
  // Future: registerCommand, setDecorations, etc.
}
```

The `EditorController` is extension-agnostic. It exposes an `ExtensionHost` via `createExtensionHost()` but never calls it itself. An `ExtensionManager` (in `src/packlets/extensions/`) manages the lifecycle externally — the project-view creates both the controller and the manager, then registers extensions.

### Worker runtime (`worker.js`)

Spun up as a standard Web Worker (same origin, no special isolation) on editor load. Communicates with the editor via `postMessage`. Worker-based extensions implement the same `Extension` interface; their `connect` function creates the worker and wires up the message channel.

### Communication protocol

Two channels:

**1. Decoration pipeline (push, unidirectional, editor → worker → editor)**

When entities change (project mutation), the editor sends the full entity list filtered to entities referencing any of the extension's game modes. The worker returns a list of decoration specs in **pulse/lane coordinates**:

```json
{
  "decorations": [
    {
      "type": "line",
      "from": { "pulse": 240, "lane": 0, "anchor": "center" },
      "to": { "pulse": 480, "lane": 1, "anchor": "center" },
      "color": "#ef4444",
      "width": 2,
      "zIndex": 0
    },
    {
      "type": "fill",
      "pulse": 240,
      "lane": 0,
      "heightPulses": 240,
      "color": "#ef4444",
      "opacity": 0.1,
      "zIndex": 0
    },
    {
      "type": "label",
      "pulse": 240,
      "lane": 0,
      "text": "START",
      "color": "#fff",
      "zIndex": 2
    }
  ]
}
```

Anchor modes: `bottom` (event anchor-point aligned), `center` (vertical midpoint), `grid` (grid line center).

The editor caches the worker's response and includes decorations in `RenderSlice.computeSpecs()` every frame — no per-frame worker calls.

**2. Request-response (bidirectional, worker ↔ editor)**

Uses JSON-RPC 2.0 over `postMessage` for operations the worker needs to perform. The editor exposes these methods:

| Method         | Params                           | Returns                  | Description                                                           |
| -------------- | -------------------------------- | ------------------------ | --------------------------------------------------------------------- |
| `readEntities` | `{}`                             | `{ entities: Entity[] }` | All entities filtered to the extension's game modes                   |
| `exportFile`   | `{ name: string, data: string }` | `{}`                     | Write exported file next to project (filesystem) or show toast (demo) |

Future methods can be added without changing the protocol.

#### RPC example

```
Worker → Editor:  { "jsonrpc": "2.0", "id": 1, "method": "readEntities", "params": {} }
Editor → Worker:  { "jsonrpc": "2.0", "id": 1, "result": { "entities": [...] } }
Worker → Editor:  { "jsonrpc": "2.0", "id": 2, "method": "exportFile", "params": { "name": "chart.bmson", "data": "..." } }
Editor → Worker:  { "jsonrpc": "2.0", "id": 2, "result": {} }
```

### Command execution flow

1. User invokes a command (via command palette, shortcut, or auto-triggered by export on save)
2. Editor sends to worker: `{ type: "execute-command", commandId: "..." }`
3. Worker performs work (may call RPC methods back to editor)
4. Worker responds: `{ type: "command-complete", commandId: "..." }`

### Export flow

1. User saves project
2. Editor checks all levels in the project. If any level references a game mode that matches an exporter's `gameModes` list, the exporter's `commandId` is triggered
3. Worker receives `execute-command`, calls `readEntities`, processes data, calls `exportFile`, responds `command-complete`

### Built-in extensions

The beat game mode (`beat-5k`, `beat-7k`) ships as a built-in extension (`src/packlets/extensions/beat-extension.ts`). It implements the same `Extension` interface but synchronously registers game modes in `connect()` without a worker.

Built-in extensions are registered by the `ExtensionManager` in `project-view` before the first render, so columns are correct from the start.

### User-installed extensions

- **URL install**: User pastes a URL pointing to `extension.json`. Editor fetches the manifest and `worker.js` (resolved relative to the manifest URL). Cached in IndexedDB.
- **ZIP install**: User drags a ZIP file. Extracted and stored in IndexedDB.

Installed extensions are stored in an editor-level extension registry (not per-project). On editor load, the `ExtensionManager` connects all registered extensions via `ExtensionHost`.

### Unknown game mode handling

When a project references a game mode not in the registry, the timeline shows an error column placeholder instead of gameplay lanes, prompting the user to install the missing extension.

### Extension UI (beyond decorations)

Not in scope for v1. Future work may include extension settings panels, sidebar views, etc.

### Consequences

- The async decoration pipeline adds latency between entity mutation and visual update (one worker round-trip). This is acceptable because decorations are relatively stable and not tied to scroll/zoom.
- Worker is same-origin. Users are told not to install untrusted extensions.
- Component schemas in the manifest must stay in sync with what the worker code actually writes. No runtime validation of this yet — trust the extension author.
- Export auto-save only works for filesystem-backed projects. Demo projects show a toast.

## Rationale

- **Worker over iframe**: simpler setup, same sandboxing (no DOM access), no cross-origin complexity. VS Code's opaque-origin iframe approach is overengineered for this use case.
- **Pulse/lane coordinates (not pixels)** for decorations: keeps viewport math in the editor. Plugins describe entities in the coordinate space they understand, and the editor handles culling/zoom/scroll.
- **JSON-RPC for request-response**: well-known standard, trivially implementable on both sides, extensible without breaking changes.
- **Cached decoration model**: avoids blocking the render loop on async worker communication. Decorations are stable between entity mutations.

## Considered Options

- **Same-origin iframe instead of Worker**: rejected — more overhead (DOM setup, hidden iframe lifecycle) for the same security properties.
- **Synchronous plugin API (load into main thread)**: rejected — risk of misbehaving code crashing the editor.
- **Pixel-coordinate decorations**: rejected — forces workers to know viewport state, breaking the clean separation.
- **`exportFile` as generic `writeFile`**: rejected — a generic write method could overwrite the project file. `exportFile` is purpose-built for exports.
