# Beat Muser

A rhythm game notechart/beatmap editor web app.

## Language

**Game mode**:
A named configuration of gameplay lanes (e.g. beat-5k, beat-7k). Defines lane count, widths, colors, and indices. Game modes are registered at runtime via the {@link GameModeRegistrySlice}; the editor core does not hardcode them.
_Avoid_: mode, layout (without "game mode" qualifier)

**Lane definition**:
A single lane within a game mode: its index (stored in note entities), display name, pixel width, background color, and note color.

**Game mode registry**:
The {@link GameModeRegistrySlice} that holds all registered game modes. Editor core queries it to build timeline columns. Future plugins register modes here.

**Level**:
A playable difficulty within a chart. Each level references a game mode by identifier (e.g. "beat-7k"). Multiple levels can coexist on the same chart with different modes.

**Column definition**:
A timeline column, which may be a gameplay lane, timing lane, sound lane, or spacer. Generated dynamically by column provider slices and assembled by {@link ColumnsSlice}.

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

- A **Chart** contains one or more **Levels**
- A **Level** references exactly one **Game mode** by identifier
- A **Game mode** contains one or more **Lane definitions**
- The **Game mode registry** holds zero or more **Game modes**
- **Column definitions** are derived from visible **Levels** + their referenced **Game mode** layouts
- A **Project** contains zero or more **Sound groups**
- A **Sound group** contains one or more **Sound channels**
- A **Sound event** references exactly one **Sound channel**

## Example dialogue

> **Dev:** "If a plugin registers a new game mode after the timeline is already visible, do the columns update automatically?"
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

## Flagged ambiguities

- "Mode" was used ambiguously to mean both game mode and tool mode (select/pencil/erase/pan). Resolved: "game mode" always refers to lane layouts; "tool" refers to the active editor tool.
