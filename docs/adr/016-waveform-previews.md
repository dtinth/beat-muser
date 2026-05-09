# ADR 016: Waveform Previews on Sound Channels

**Status:** Accepted

**Date:** 2026-05-09

---

## Context

Sound events on the timeline currently render as colored DOM rectangles with labels (channel name + command). Users need to see what the audio file actually sounds like — where the transients are, how long the tail is, where the quiet sections are. A waveform preview on each sound event solves this.

The established rendering system is DOM-based (absolutely positioned `<div>` elements). A waveform could require hundreds of thin bars per event — impractical with individual DOM elements.

---

## Decision 1: Canvas-based waveform rendering with 512px partitioning

### Context

DOM elements cannot efficiently render hundreds of bars per sound event. Canvas can, but a single tall canvas (e.g., a 2000px background music track) wastes GPU memory and hurts scroll performance.

### Decision

Use `<canvas>` elements for waveform bars, with a hard cap of 512 CSS pixels per canvas. Events taller than 512px are split into multiple vertically-adjacent canvases, each covering at most 512px of timeline height.

### Rationale

- Canvas avoids DOM overhead for dense bar charts
- 512px partitions keep individual canvases small for efficient GPU texture management
- The scrollable canvas already handles virtual scrolling and element lifecycle — each partitioned canvas is just another render object

---

## Decision 2: External audio-engine packlet with delegate pattern

### Context

Audio file loading and decoding requires the Web Audio API. The editor-core packlet should remain a pure domain model — it doesn't know about `AudioContext`, `decodeAudioData`, or the file system.

### Decision

A new `audio-engine` packlet (`src/packlets/audio-engine/`) handles all audio I/O:

- Created via `createAudioEngine({ fileSystem, delegate })` — receives the project file system and a delegate object
- File paths are pushed in via `setFilePaths(paths: string[])` — creator subscribes to the `SoundChannelSlice.$soundFilePaths` atom and calls this
- Results are reported through the delegate: `onWaveformReady(path, data)` and `onWaveformError(path, error)`
- The delegate is wired at creation time to push data into `EditorController.waveform`
- The audio-engine has no dependency on nanostores or editor-core

### Rationale

- Editor-core stays pure and testable without Web Audio API or file system knowledge
- The audio-engine can be tested independently with synthetic audio buffers
- The delegate pattern avoids nanostores coupling in the audio-engine packlet (the creator wires it up)
- Similar in spirit to the outbox pattern used by `EditorController` (ADR 003)

### Considered Alternatives

- **Audio loading inside editor-core**: Would mix domain logic with browser APIs, making core tests require DOM
- **Audio engine exposes nanostores atoms**: Adds unnecessary framework dependency to a pure I/O packlet

---

## Decision 3: Two-layer waveform display (RMS + peak)

### Context

Peak amplitude alone misses the perceived loudness of audio. A loud section with one brief transient looks the same as a sustained loud passage.

### Decision

Display two superimposed layers per waveform bar:

- **RMS layer** (more opaque, ~65%): Shows the root-mean-square amplitude per chunk — represents perceived loudness
- **Peak layer** (less opaque, ~35%): Shows the maximum absolute amplitude per chunk — represents transients

Both computed per 1/120-second chunk (~8.3ms), stereo-max (max of left and right channels). Color derived from the sound channel's parent group color.

### Rationale

- Two layers communicate both transient intensity (peak) and perceived loudness (RMS)
- Group color ties the waveform to the sound group's visual identity in the sidebar
- 1/120s chunk size (~8.3ms) gives smooth visual at typical zoom while keeping data manageable

---

## Decision 4: Pre-sliced waveform arrays in render specs

### Context

The render spec is a pure data object passed to stateless renderer factories. Waveform data is large — a single file can produce thousands of chunks. Passing full arrays is wasteful; only the visible portion matters.

### Decision

The `RenderSlice` pre-slices the `Float32Array`s via `.subarray()` for the portion visible in each canvas's pixel range. The sliced arrays are included in the render spec's `data` field, alongside metadata (`channelPath`, `sampleRate`, `startChunk`). The canvas renderer receives everything it needs from the spec — no atom lookups.

Downsampling: when multiple waveform chunks map to a single pixel row, peak uses `max` of all chunks in that pixel and RMS uses `mean` of all chunks.

### Rationale

- Keeps renderer factories stateless — they only render what they receive
- `Float32Array.subarray()` is O(1) with no allocation (creates a view)
- Pre-filtering to visible range avoids passing megabytes of unused data through specs

---

## Decision 5: Waveform slicing computation as a pure module

### Context

Sound events use the `continue` command to resume playback from where the previous event on the same channel left off. To render the correct waveform section, we need to compute:

- For `play` events: start at sample offset 0, trimmed at the next event's pulse
- For `continue` events: start at the cumulative sample offset from the preceding `play` chain, trimmed at the next event's pulse
- Both expressed as pulses (for pixel positioning) and seconds-into-sample (for waveform array indexing)

### Decision

Implement this logic as a pure computation module in editor-core (`waveform-slicer.ts`) with colocated unit tests. It takes sound events for a chart and returns per-event trim data. The `RenderSlice` calls it when generating waveform render specs.

### Rationale

- Pure function, no side effects — fully testable without editor setup
- Editor-core is the right home because it owns the domain (sound events, channels, pulses)
- Separating from `RenderSlice` keeps the render slice focused on spec generation

---

## Decision 6: No waveform shown until data is available

### Context

The audio-engine decodes and computes asynchronously. There is a gap between project open and waveform display.

### Decision

When waveform data is not yet available (loading) or failed (error), the waveform canvas is simply omitted. The DOM event-marker always renders with its label regardless. No loading skeleton, no placeholder — the waveform appears when ready.

### Rationale

- Simplest implementation with no degradation in core UX (the event-marker is still there)
- User can work with sound events immediately; waveforms fill in progressively
- Avoids coordination complexity between loading states and the render pipeline

---

## Decision 7: Concurrency control for audio decoding

### Context

A project may have dozens of sound channels. Browser `AudioContext.decodeAudioData()` is CPU-intensive and browsers may throttle or fail if too many files are decoded simultaneously.

### Decision

Use `p-limit` (a tiny concurrency limiter library) in the audio-engine to cap concurrent decodes. The limit defaults to 4 but is configurable at construction: `createAudioEngine({ fileSystem, delegate, maxConcurrentDecodes?: number })`.

### Rationale

- `p-limit` is ~500 bytes with zero dependencies — not worth writing our own
- Capping at 4 concurrent decodes keeps the UI responsive while processing files in reasonable time
- Configurable limit lets callers tune for their use case

### Considered Alternatives

- **No limit**: Realistic projects with 20+ channels would thrash the browser
- **Custom concurrency limiter**: Reinventing a tiny well-tested library

---

## Decision 8: Asynchronous waveform computation

### Context

Computing peak and RMS per 1/120s chunk requires iterating the full decoded `AudioBuffer` (~8 million samples per channel for a 3-minute stereo track at 44.1kHz). A synchronous loop blocks the main thread for a noticeable period.

### Decision

The waveform computation runs asynchronously: it processes the audio buffer in batches, yielding to the event loop between batches (via `setTimeout(fn, 0)` or `scheduler.yield()`). It returns a `Promise<WaveformData>` so the audio-engine awaits it without blocking.

### Rationale

- Keeps the UI interactive while large files are being preprocessed
- Avoids Web Worker complexity (bundling, message passing, transferable buffers)
- Yielding every ~32ms of audio processed is imperceptible to the user while adding minimal overhead

---

## Decision 9: File status tracking in WaveformSlice

### Context

Waveform processing is now multi-stage (queued → decoding → computing → ready), and can fail at any stage. The user benefits from seeing processing progress, especially in the sound channel sidebar.

### Decision

The `WaveformSlice` tracks a status per file path via a `$waveformStatus` atom (`Map<string, WaveformStatus>`):

```text
nothing           — file not yet seen by audio engine
loading           — decoding in progress
decoding-failed   — file unreadable, corrupt, or unsupported format
generating        — audio decoded, computing peak/RMS arrays
ready             — waveform data available in $waveformData
```

The audio-engine delegate calls `setWaveformStatus(path, status)` at each transition. The sidebar reads `$waveformStatus` to show status indicators next to sound channels.

### Rationale

- Five states cover the full lifecycle with clear boundaries between stages
- Separating `loading` from `generating` lets the UI show two distinct progress indicators (e.g., spinner vs. waveform icon)
- Status is transient (not persisted) — same as waveform data itself
- The sounds sidebar already shows channels with their group color; a small status badge fits naturally

---

## Consequences

- **New packlet:** `src/packlets/audio-engine/` with its own index.ts and tests
- **New slice:** `WaveformSlice` in editor-core stores waveform data and status, exposed as `editorController.waveform`
- **New dependency:** `p-limit` for concurrency control in audio-engine
- **New render type:** `"waveform"` timeline render spec type
- **New renderer factory:** `createWaveformRenderer()` in `project-view/waveform-renderer.ts`
- **RenderSlice change:** subscribes to `$waveformData`, includes waveform data in sound event specs
- **SoundChannelSlice change:** gains `$soundFilePaths` derived atom
- **WaveformSlice API:** `$waveformData` (atom), `$waveformStatus` (atom), `setWaveformData(path, data)`, `setWaveformStatus(path, status)`, `removeWaveformData(path)`
- **Performance consideration:** Very long audio files (background music) produce many waveform chunks; the 512px canvas partitioning and pre-slicing mitigate this
