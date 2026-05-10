# Coordinate Spaces

This document defines the coordinate spaces used across the Beat Muser editor.
The timeline flows from bottom to top — earlier time at the bottom, later time
at the top. Pulse 0 (song start) maps to a large Y value; the chart end maps to
a small Y value near 0.

The coordinate spectrum spans spatial (pixels) to temporal (pulses, seconds,
audio frames). Each space has a distinct purpose, a naming suffix convention,
and documented conversion functions.

---

## Base spaces

These three spaces form the core timeline coordinate system used by all
renderers (column backgrounds, grid lines, event markers, playhead, etc.).

### Timeline Y space

| Property    | Value                                                       |
| ----------- | ----------------------------------------------------------- |
| **Suffix**  | `Y` (e.g. `scrollY`, `segmentY`, `waveformBottomY`)         |
| **Unit**    | Pixel                                                       |
| **Range**   | 0 (top, end of chart) – `trackHeight` (bottom, pulse 0)     |
| **Purpose** | Absolute position of a DOM element on the scrollable canvas |

```
Y = trackHeight - pulse * scaleY
pulse = (trackHeight - Y) / scaleY
```

### Pulse space

| Property    | Value                                                                                                      |
| ----------- | ---------------------------------------------------------------------------------------------------------- |
| **Suffix**  | `Pulse` (e.g. `eventPulse`, `trimPulse`, `cursorPulse`)                                                    |
| **Unit**    | Pulse (PPQN = 240)                                                                                         |
| **Range**   | 0 (song start) – `chartSize`                                                                               |
| **Purpose** | Musical position on the chart. Linear in Y — each pixel spans a fixed number of pulses regardless of tempo |

### Chart time space

| Property    | Value                                                                                                |
| ----------- | ---------------------------------------------------------------------------------------------------- |
| **Suffix**  | `ChartSec` (e.g. `eventChartSec`, `playedChartSec`)                                                  |
| **Unit**    | Seconds since song start (pulse 0)                                                                   |
| **Range**   | 0 – chart duration                                                                                   |
| **Purpose** | Real-time position in the song. Non-linear with pulse due to BPM changes. Provided by `TimingEngine` |

```
chartSec = timingEngine.pulseToSec(pulse)     // O(log N) — binary search over BPM changes
pulse    = timingEngine.secToPulse(chartSec)  // inverse
```

---

## Playback-related spaces

These spaces are introduced by the audio playback system (ADR 017). They connect
chart time to the Web Audio API clock for sample-accurate event scheduling.

### Audio context time space

| Property    | Value                                                                                                      |
| ----------- | ---------------------------------------------------------------------------------------------------------- |
| **Suffix**  | None — variables use `contextTime`, `startContextTime`, `currentContextTime`                               |
| **Unit**    | Seconds                                                                                                    |
| **Range**   | 0 – ∞                                                                                                      |
| **Purpose** | `AudioContext.currentTime` — the Web Audio API's high-resolution clock used for sample-accurate scheduling |

```
startContextTime = audioContext.currentTime  // captured when play begins
```

### Playback time space

| Property    | Value                                                                                                                                         |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Suffix**  | `PlaybackSec` (e.g. `playbackSec`, `triggerPlaybackSec`, `lookaheadPlaybackSec`)                                                              |
| **Unit**    | Seconds since play was pressed                                                                                                                |
| **Range**   | 0 – chart duration                                                                                                                            |
| **Purpose** | Elapsed playback time. The audio engine reports `currentPlaybackSec` on each tick; `createPlayback` uses it to determine which events to emit |

### Playback time ↔ Audio context time conversion

```
playbackSec = (currentContextTime - startContextTime) * rate
contextTime = startContextTime + triggerPlaybackSec / rate
```

| Variable             | Unit         | Meaning                                                 |
| -------------------- | ------------ | ------------------------------------------------------- |
| `currentContextTime` | seconds      | `AudioContext.currentTime` at the current tick          |
| `startContextTime`   | seconds      | `currentTime` captured when play begins                 |
| `playbackSec`        | Playback sec | Elapsed playback time (slower/faster depending on rate) |
| `rate`               | unitless     | Speed multiplier (1.0 = normal, 0.5 = half-speed)       |

At rate=0.5, an event at `triggerPlaybackSec=1.0` schedules at `contextTime = start + 2.0`,
and the source's `playbackRate` is set to 0.5 — the audio plays at half speed
(pitch-shifted relative to the source file).

The audio engine calls `Playback.onPlaybackTimeChange(currentPlaybackSec)` on each tick
(~25ms). The `Playback` implementation (provided by `createPlayback`) converts
`playbackSec` to a pulse via
`timingEngine.secToPulse(cursorChartSec + playbackSec)` and notifies the editor
via an internal callback.

---

## Waveform-extended spaces

These three additional spaces are introduced by waveform previews. Rendering
space extends the spatial end; Audio time and Frame extend the temporal end.

### Rendering space

| Property    | Value                                                                 |
| ----------- | --------------------------------------------------------------------- |
| **Suffix**  | `Rp` (e.g. `rpStart`, `rpLength`, `renderingPos`)                     |
| **Unit**    | Pixel (offset from eventPulse)                                        |
| **Range**   | 0 (eventPulse, waveform start) – `rpLength` (trimPulse, waveform end) |
| **Used by** | `computeWaveformSegments`, `getWaveformPixels`                        |
| **Purpose** | Position within a waveform block, counting upward from the sound      |

event's pulse toward the next event. Segments are contiguous slices:
`[0, 512)`, `[512, 1024)`, … |

Rendering space counts **earlier → later**: `rp=0` is the beginning of the audio
(at the event pulse), `rp=rpLength` is the end (at the trim pulse).

To Y: `Y = waveformBottomY - rp`. From Y: `rp = waveformBottomY - Y`.

### Audio time space

| Property      | Value                                                               |
| ------------- | ------------------------------------------------------------------- |
| **Suffix**    | `AudioSec` (e.g. `audioSec`, `sampleOffsetAudioSec`)                |
| **Unit**      | Seconds since start of the audio file                               |
| **Range**     | 0 – `durationSec`                                                   |
| **Purpose**   | Position within a decoded audio file. Independent of chart position |
| **Stored in** | `WaveformSlice.$waveformData`                                       |

```
audioSec = chartSec - eventChartSec + sampleOffsetAudioSec
```

For `play` commands, `sampleOffsetAudioSec` is 0. For `continue`, it is the
cumulative chart time consumed by prior events in the chain (computed by
`computeWaveformOffsets()`).

### Waveform frame space

| Property      | Value                                                                             |
| ------------- | --------------------------------------------------------------------------------- |
| **Suffix**    | `Frame` (e.g. `frameStart`, `frameEnd`, `framesPerSec`)                           |
| **Unit**      | Frame index (120 frames/second)                                                   |
| **Range**     | 0 – `frameCount`                                                                  |
| **Purpose**   | Index into the `Float32Array peak[]` and `rms[]` arrays stored in `WaveformSlice` |
| **Stored in** | `WaveformSlice.$waveformData`                                                     |

```
frame = floor(audioSec * 120)
```

---

## Naming convention

Every variable carries its space as a suffix. This makes it obvious at a glance
which coordinate system a value belongs to.

| Space          | Suffix        | Examples                                                    |
| -------------- | ------------- | ----------------------------------------------------------- |
| Timeline Y     | `Y`           | `segmentY`, `waveformBottomY`, `scrollY`                    |
| Rendering      | `Rp`          | `rpStart`, `rpLength`, `renderingPos`                       |
| Pulse          | `Pulse`       | `eventPulse`, `trimPulse`, `cursorPulse`                    |
| Chart time     | `ChartSec`    | `eventChartSec`, `cumulativeChartSec`                       |
| Audio time     | `AudioSec`    | `audioSec`, `sampleOffsetAudioSec`                          |
| Playback time  | `PlaybackSec` | `playbackSec`, `triggerPlaybackSec`, `lookaheadPlaybackSec` |
| Waveform frame | `Frame`       | `frameStart`, `frameEnd`, `framesPerSec`                    |

**Conversion functions** are named `toSpaceFromSpace`: `pulseToY(pulse)`,
`yToPulse(y)`, `chartSecToAudioSec(sec)`, `audioSecToFrame(sec)`.

---

## Full conversion chain (waveform previews)

Reading left to right: rendering position flows through the spatial side (Y,
pulse), crosses into the temporal side (chart time, audio time), and lands at a
frame index.

```
Rendering      TimelineY      Pulse         ChartTime      AudioTime       Frame
  rp               Y           pulse         chartSec       audioSec        frame
  ──────→ yToRp    ──────→ yToPulse   ───→ pulseToChartSec   ───→ chartSecToAudioSec   ───→ audioSecToFrame
  ←────── rpToY    ←────── pulseToY  ←─── chartSecToPulse   ←─── audioSecToChartSec   ←─── frameToAudioSec
```

---

## Key invariants

1. **Earlier → later.** All computation flows from earlier (eventPulse,
   rendering 0, frame 0) toward later (trimPulse, rendering N, frame N).
   Nothing reverses direction mid-pipeline.

2. **Only the canvas reverses.** `drawWaveform()` in `waveform-renderer.ts`
   is the sole place where array index is mapped to canvas position in
   reverse (draws `peak[rpLength - 1 - py]` at row `py`), matching the
   timeline's bottom-to-top time flow.

3. **Segments are contiguous in rendering space.** `computeWaveformSegments()`
   splits `[0, rpLength)` into ≤512-frame slices. Each segment's `rpStart`
   is its offset from eventPulse.

4. **Segment positioning.** A segment at `[rpStart, rpStart+rpLength)` is
   placed at `Y = waveformBottomY - rpStart - rpLength` on the canvas.

5. **`getWaveformPixels()`** returns arrays in earlier→later order:
   `peak[0]` = earliest audio, `peak[N-1]` = latest. No reversal inside
   this function.

---

## Code locations

| Concept                             | File                                                               |
| ----------------------------------- | ------------------------------------------------------------------ |
| Timeline Y ↔ Pulse conversion       | `render-slice.ts:computeSpecs` (via `scaleY`, `trackHeight`)       |
| Pulse ↔ Chart time                  | `timing-engine/index.ts` (`pulseToSec`, `secToPulse`)              |
| Rendering → Frame (full chain)      | `render-slice.ts:computeWaveformSlices` → `getFrameRange` callback |
| Segment partitioning                | `waveform-segments.ts:computeWaveformSegments`                     |
| Canvas drawing (display reversal)   | `waveform-renderer.ts:drawWaveform`                                |
| Sound slice offsets (play/continue) | `waveform-slicer.ts:computeWaveformOffsets`                        |
| Waveform frame data storage         | `slices/waveform-slice.ts`                                         |
| Render spec generation              | `render-slice.ts:computeSpecs`                                     |
