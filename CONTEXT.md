# Beat Muser

A rhythm game notechart/beatmap editor web app.

## Language

**Extension**:
A self-contained package that extends the editor with new game modes, entity components, commands, exporters, and timeline decorations. All extensions implement the `Extension` interface: a `manifest` and a `connect(host)` function. Built-in extensions (like beat mode) register game modes synchronously; downloaded extensions wrap a Web Worker behind the same API. Installed at the editor level.
_Avoid_: plugin, addon, mod

**Extension manifest** (`extension.json`):
A JSON file declaring the extension's `id`, `name`, `version`, contributed `gameModes`, `components`, `commands`, and `exporters`. Purely declarative — no executable code. The single source of truth for what an extension contributes.
_Avoid_: plugin manifest, config file

**Extension worker** (`worker.js`):
A Web Worker script that contains the extension's runtime logic. Receives entity data on mutation and returns decoration specs. Handles command execution via message passing. Communicates with the editor via JSON-RPC 2.0 over `postMessage` for request-response operations (e.g., reading entities, exporting files).

**Extension host**:
The editor-side API surface that extensions interact with via `connect(host)`. Provides methods like `registerGameMode()`. Created by `EditorController.createExtensionHost()` — the controller is extension-agnostic and never calls it internally.

**Extension manager**:
An orchestrator (`src/packlets/extensions/`) that manages extension lifecycle (register, unregister). Created in the app layer (`project-view`), receives the `ExtensionHost` from the controller, and registers built-in and user-installed extensions.

**Entity component schema**:
A declarative schema in the extension manifest describing a custom entity component (e.g. `fingerId`, `drag`). The editor uses these schemas to drive the inspector UI, clipboard handling, and schema validation. Data is stored as-is via `additionalProperties: true` on existing component objects.

**Decoration spec**:
A render description produced by the extension worker, expressed in pulse/lane coordinates. Types: `line` (connecting two points), `fill` (colored region), `label` (text overlay). Each point specifies an **anchor mode**. The editor converts pulse/lane to pixel coordinates, handles culling, and composites decorations into the timeline.
_Avoid_: render object, overlay (without "decoration" qualifier)

**Anchor mode**:
Controls how a decoration's pulse coordinate maps to Y position. `bottom` = bottom of the event marker aligns with the pulse (default for event markers), `center` = vertical midpoint of the event object, `grid` = the grid line center. Used by decoration specs to correctly connect visual elements.

**Exporter**:
A declarative mapping in the extension manifest from a set of game modes to a command ID. When the project is saved and contains at least one level matching any of the listed game modes, the editor triggers the mapped command. The extension worker then reads entities via RPC and writes the exported file via `exportFile`.
_Avoid_: export plugin, save hook

**Extension registry**:
The editor-level store of installed extension metadata and worker scripts. Persisted in IndexedDB. The **Extension manager** reads from the registry on editor load to connect all registered extensions. Separate from the game mode registry — it manages the full lifecycle (install, uninstall, update).

## Language

**Game mode**:
A named configuration of gameplay lanes (e.g. beat-5k, beat-7k). Defines lane count, widths, colors, and indices. Game modes are registered at runtime via the {@link GameModeRegistrySlice}; the editor core does not hardcode them.
_Avoid_: mode, layout (without "game mode" qualifier)

**Lane definition**:
A single lane within a game mode: its index (stored in note entities), display name, pixel width, background color, and note color.

**Game mode registry**:
The {@link GameModeRegistrySlice} that holds all registered game modes. Editor core queries it to build timeline columns. Extensions register modes here via their manifest.

**Level**:
A playable difficulty within a chart. Each level references a game mode by identifier (e.g. "beat-7k"). Multiple levels can coexist on the same chart with different modes.

**Column definition**:
A timeline column, which may be a gameplay lane, timing lane, sound lane, or spacer. Generated dynamically by column provider slices and assembled by {@link ColumnsSlice}.

**Quarter note**:
The unit used to display and edit chart length in the sidebar. Equal to 240 pulses (PPQN). Independent of time signature — always beats = pulses / 240.

**Chart length**:
The `size` field on a **Chart** entity, stored in pulses. Displayed and edited in **Quarter notes** in the Chart Info panel. Default is 15360 pulses (64 quarter notes = 16 measures of 4/4). Silently clamped to a minimum of `ceil(maxEventPulse / 240)` to prevent shrinking below the last event. Auto-extends reactively when events are placed past the end: within 4 quarter notes → grows by 16 quarter notes; beyond → rounds up to the nearest 16-quarter-note boundary.

**Sound group**:
A project-global grouping for related sound channels (e.g., "Drums", "Vocals"). Carries a display name and optional color. Every **Sound channel** belongs to exactly one group; groups are created before channels.

**Sound channel**:
A project-global audio file reference that belongs to exactly one **Sound group**. Identified by its file path relative to the project directory. The display name is derived from the path (basename without extension). Can be created blank (no path assigned yet) and populated later via file picker or drag-and-drop. Sound events on the timeline trigger sound channels.
_Avoid_: sample, audio file (without "channel" qualifier)

**Sound event**:
A timed entity on a chart's sound lane that triggers a **Sound channel** at a specific pulse. Has a command (`play` or `continue`).

**Waveform data**:
A pre-computed visual envelope of an audio file: peak amplitude and RMS loudness per 1/120-second chunk, taken as the maximum of both stereo channels. Derived transiently from the audio file — not persisted in the project file. Stored as a pair of `Float32Array`s keyed by file path. Each file has a **Waveform status** tracking the pipeline state.
_Avoid_: waveform (without "data" qualifier when referring to the stored data)

**Waveform status**:
The processing state of a sound file in the waveform pipeline: `nothing` (file not yet seen by the audio engine), `loading` (decoding in progress), `decoding-failed` (file unreadable or corrupt), `generating` (computing peak/RMS arrays), or `ready` (waveform data available). Exposed via the **Waveform slice** atom for sidebar display. _Avoid_: waveform state (ambiguous with React state)

**Waveform slice**:
The {@link WaveformSlice} in editor-core that stores waveform data and status keyed by file path. Exposes readable atoms (`$waveformData`, `$waveformStatus`) consumed by the render slice and sidebar, and setter methods called by the audio engine delegate.

**Audio engine**:
A separate packlet (`src/packlets/audio-engine/`) responsible for loading audio files from the project file system, decoding them via the Web Audio API, computing waveform data, and reporting results to the waveform slice via a delegate. Owns no editor state — it is a pure I/O and computation layer.

**Waveform slicing**:
The computation that determines, for each sound event on the timeline, how much of the referenced audio file is visible: the start offset (seconds into the sample, accounting for `continue` events that resume from prior position), and the trim point (pulse of the next event on the same lane).

**Chart time**:
A coordinate system for playback scheduling measured in real seconds from the start of playback. Independent of playback rate — the audio engine divides chart time by rate to convert to `AudioContext.currentTime`. `createPlayback` works exclusively in chart time.

**Playback contract**:
A neutral packlet (`src/packlets/playback-contract/`) defining shared interfaces consumed by both editor-core and audio-engine. Decouples scheduling logic from audio I/O so both sides can be tested independently.

**Playback**:
An object produced by `createPlayback` that yields scheduled sound events via `getEvents(lookaheadPlaybackSec)`. Think of it as a deque: each call returns events between the last window and the new lookahead time. Carries an `AbortSignal` for pause/stop.

**Playback event**:
A scheduled sound trigger with `triggerPlaybackSec` (when), `fileName` (which file), `audioStartSec` and `audioEndSec` (what segment). `continue` chains are coalesced inside `Playback` so the audio engine never sees them.

**Playback slice**:
The {@link PlaybackSlice} in editor-core that holds transport state (`$transportState`: `stopped | playing | paused`) and the current playback position (`$playbackPulse`). Delegates to `createPlayback` for event scheduling logic.

**Playback rate**:
A speed multiplier applied to playback. At 1.0x, playback time and context time are the same. At 0.5x, playback time elapses at half speed. Rate is passed as a parameter to `startAudioPlayback()` alongside the `Playback` object and applied both to scheduling math and `source.playbackRate`.

## Relationships

- A **Chart** contains one or more **Levels**
- A **Level** references exactly one **Game mode** by identifier
- A **Game mode** contains one or more **Lane definitions**
- The **Game mode registry** holds zero or more **Game modes**
- **Column definitions** are derived from visible **Levels** + their referenced **Game mode** layouts
- A **Project** contains zero or more **Sound groups**
- A **Sound group** contains one or more **Sound channels**
- A **Sound event** references exactly one **Sound channel**
- **Waveform data** is derived from a **Sound channel**'s audio file by the **Audio engine**
- The **Audio engine** feeds **Waveform data** into the **Waveform slice**
- The **Render slice** reads the **Waveform slice** to generate waveform render specs
- The **Playback slice** produces a **Playback** object from sound events + timing engine
- The **Audio engine** consumes a **Playback** object via the **Playback contract** to schedule audio
- **Playback events** are derived from **Sound events** with `continue` chains coalesced
- A **Chart** has a **Chart length** in pulses (the `size` field), displayed and edited as **Quarter notes**
- The **Chart length** minimum is determined by the last **Event**'s pulse on that chart
- The **Chart length** auto-extends when events exceed it, using the **Quarter note** unit for its thresholds
- An **Extension** contributes zero or more **Game modes** via the **Game mode registry**
- An **Extension** declares zero or more **Entity component schemas**
- An **Extension** declares zero or more **Commands** in its manifest
- An **Extension** declares zero or more **Exporters**, each binding a **Command** to a set of **Game modes**
- An **Extension** calls `registerGameMode()` on the **Extension host** in its `connect()` function
- An **Extension manager** manages the lifecycle of all **Extensions**
- The **Extension host** is created by `EditorController.createExtensionHost()` and wired to the **Game mode registry**
- An **Extension** spawns an **Extension worker** on editor load (worker-based extensions only)
- The **Extension worker** receives entity data on mutation and returns **Decoration specs**
- The **Render slice** includes cached **Decoration specs** in the visible render objects
- The **Extension worker** calls `readEntities` and `exportFile` via JSON-RPC during command execution
- An **Exporter** triggers its bound **Command** when the project is saved and contains a matching **Level**

## Example dialogue

> **Dev:** "If an extension registers a new game mode after the timeline is already visible, do the columns update automatically?"
> **Domain expert:** "Yes — the {@link LevelColumnsSlice} subscribes to the {@link GameModeRegistrySlice}'s `$modes` atom, so registering a mode triggers a column refresh."

> **Dev:** "Can I create a sound channel without assigning a file?"
> **Domain expert:** "Yes — you create a blank channel inside a group, then assign the file later via the file picker command or by dragging an audio file into the group."

> **Dev:** "If a sound event uses `continue` and the previous event was trimmed by the next event on the lane, where does the continue event start drawing?"
> **Domain expert:** "The **Waveform slicing** logic tracks the cumulative elapsed time from the last `play` event. A `continue` event picks up from where the previous event's playback stopped, as if the audio file kept running between events. The waveform canvas shows the corresponding section of the audio file."

> **Dev:** "What happens if the audio engine hasn't finished computing the waveform data for a file?"
> **Domain expert:** "The waveform canvas simply isn't rendered — the DOM event-marker still shows with its label. Once waveform data arrives, the render slice regenerates specs and the canvas appears."

> **Dev:** "During playback, how does the audio engine know when to schedule the next batch of sounds?"
> **Domain expert:** "It runs a tick loop (~25ms interval). Each tick, it computes `currentPlaybackSec = (currentContextTime - startContextTime) * rate`, adds a lookahead window (e.g. 200ms), and calls `playback.getEvents(lookaheadPlaybackSec)` to get the next batch of **Playback events**. It converts each event's playback time to context time via `startContextTime + triggerPlaybackSec / rate` and schedules `AudioBufferSourceNode.start(time)`."
>
> **Dev:** "What happens if the chart has a `continue` sound event — does the audio engine need to handle that?"
> **Domain expert:** "No — `createPlayback` coalesces `continue` chains into a single **Playback event** with the correct `audioStartTime`. The audio engine just sees flat, independent events."

## Resolved design — Horizontal column dragging

When dragging events on the timeline, the {@link DragSlice} handles vertical (pulse) movement. The horizontal (column) component allows entities to move between gameplay lanes and sound lanes. Key design points:

**Column flat list**:
A filtered list of {@link TimelineColumn} objects sharing the same **Drag affinity** as the anchor column. Computed at drag start via {@link buildFlatList} by filtering columns whose `affinity` property matches the anchor column's. Only columns with `affinity` set (`"gameplay"` or `"sound"`) participate; timing columns and spacers have no affinity and are excluded.

**Anchor column**:
The column the user clicked on to start a drag. Its position in the flat list establishes the reference point (column index 0 in offset space). Other selected entities track their offset from the entity's parent column index.

**Drag affinity**:
A property of {@link ColumnDefinition} (`"gameplay"` or `"sound"`) set by column providers. Used to build the flat list by filtering to same-affinity columns. Timing events (BPM, time signature) sit on columns with no affinity and never move horizontally. `{@link DragSlice}` stores `originalColumnIndices` (a `Map<entityId, columnIndex>`) but no longer stores an affinity string — horizontal movement is implicitly gated by whether `originalColumnIndices` is non-empty.

**Delta column index**:
The horizontal offset component of a drag. Calculated as: cursor's target flat-list index — anchor column's original flat-list index. Clamped so the entire selection's horizontal range stays within the flat list bounds. Applied as a uniform offset to all entities. DragSlice stores this as a single integer alongside `deltaPulse`.

**Ghost rendering for horizontal drags**:
Ghost preview during a drag shows the entity in its target column (original flat-list index + delta column index). Originals stay in place at 30% opacity; ghosts render at 50% opacity in the target column at the same Y position (optionally + vertical delta for combined moves).

**Horizontal drag thresholds**:
The 5px drag threshold uses Euclidean distance (sqrt(dx² + dy²)) to enter dragging mode, enabling pure horizontal lane changes without vertical movement.

**Commit on pointer up**:
When dragging commits, each entity's pulse is updated via {@link EditBatchBuilder.setPulse}. For horizontal moves, the target column's `moveEntityTo` closure is called, which applies column-specific edits: notes get new `NOTE.lane` + `LEVEL_REF.levelId`, sound events get new `SOUND_EVENT.soundLane` and trigger a **Keysound cascade** to update any `KEYSOUND` references at the same pulse. The `{@link PointerInteractionSlice}` delegates both pulse and column mutations to the batch builder without branching on column type.

## Resolved design — Clipboard (copy/paste/cut)

**Clipboard entry**: A serializable JSON object stored via the browser Clipboard API with `text/plain` MIME type. Discriminated by a `$schema` field; paste silently no-ops if absent.

```json
{
  "$schema": "https://beat-muser.pages.dev/schemas/beat-muser-clipboard.schema.json",
  "e": [
    {
      "EVENT": { "y": 480, "chartId": "abc" },
      "NOTE": { "lane": 2 },
      "LEVEL_REF": { "levelId": "beat-7k" }
    }
  ]
}
```

- `e` is an array of **component maps** (the entity's `components` record). No `id` or `version` — those are generated fresh via `uuidv7()` on paste.
- Component fields like `chartRef.chartId` and `levelRef.levelId` are preserved as-is from the source. Column validation (see **Column mismatch**) determines whether the entity can be pasted into the target chart — these IDs are not rewritten.
- All selectable entity types (notes, sound events, BPM changes, time signatures) are copyable.

**Paste positioning**: The earliest entity in the clipboard (by `EVENT.y`) anchors to the current **cursor pulse**. All other entities preserve their relative pulse offset.

**Column mismatch**: Entities whose column (lane/sound lane) doesn't exist in the target chart are silently skipped. Others paste normally.

**Post-paste selection**: All newly pasted entities are selected.

**Cut**: Copy to clipboard then delete the selection via the existing `DeleteUserAction`. Single undo step.

**Undo**: One paste = one undo step. Copied entities get new UUIDs; the `PasteEntitiesUserAction` stores them for undo (undo deletes, redo re-inserts).

**Keyboard shortcuts**: `$mod+C` (copy), `$mod+X` (cut), `$mod+V` (paste). Copy is read-only (no undo entry).

**Architecture**: A `{@link ClipperSlice}` in editor-core holds serialization/deserialization and Clipboard API interaction. `EditorController` exposes thin wrappers (`copySelection()`, `paste()`, `cutSelection()`). Commands registered in `project-view` call these methods.

**Copy during playback**: Allowed — read-only, no special restrictions. Cut and paste during playback: allowed. Mutating the project (cut/paste/delete) is permitted during playback with no additional restrictions beyond those applied to all editing operations.

## Example dialogue

> **Dev:** "When the user drags a note in touch mode, does the extension worker need to be notified in real time?"
> **Domain expert:** "No — the worker only processes entity data. The editor handles all pointer interaction natively. After the drag commits and the entity is updated, the worker is sent the new entity list and recalculates decorations."

> **Dev:** "What happens if the extension worker crashes?"
> **Domain expert:** "The editor catches the `error` event on the worker. Decorations disappear silently. Commands fail with a toast. The extension remains installed but disabled until the user reloads the editor or re-installs."

> **Dev:** "Can two extensions register the same game mode ID?"
> **Domain expert:** "The second registration overwrites the first — same as ADR 014's `registerGameMode` behavior. A warning is logged."

> **Dev:** "During export, does the worker receive all entities or only matching ones?"
> **Domain expert:** "The `readEntities` RPC method returns all entities filtered to levels whose game mode matches the exporter's declared list. The worker never sees other project data."

> **Dev:** "If a project uses game mode `touch-5k` and I haven't installed the touch extension, what does the user see?"
> **Domain expert:** "The timeline column area shows a placeholder: 'Unknown game mode `touch-5k` — install the extension to edit this level.' The grid and cursor still work; gameplay columns are just absent."

## Flagged ambiguities

- "Mode" was used ambiguously to mean both game mode and tool mode (select/pencil/erase/pan). Resolved: "game mode" always refers to lane layouts; "tool" refers to the active editor tool.
- "Plugin" was used in ADR 014 and early discussions. Resolved: use **Extension** for the full system (package + worker). "Plugin" is ambiguous with browser extensions and VS Code's "extension" convention is more widely understood.
