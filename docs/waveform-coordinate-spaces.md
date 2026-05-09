# Waveform Coordinate Spaces

This document defines the coordinate spaces used for waveform preview rendering
on the Beat Muser timeline. The timeline flows from bottom to top — earlier time
at the bottom, later time at the top. Pulse 0 (song start) maps to a large Y
value; the chart end maps to a small Y value near 0.

The coordinate spectrum spans spatial (pixels, Y) and temporal (pulses, seconds,
audio frames). Each space has a distinct purpose, a naming suffix convention, and
documented conversion functions.

---

## Base spaces (exist before waveform previews)

These three spaces form the core timeline coordinate system used by all renderers,
not just waveform previews.

### 1. Timeline Y space

| Property    | Value                                                       |
| ----------- | ----------------------------------------------------------- |
| **Suffix**  | `Y` (e.g. `scrollY`, `segmentY`)                            |
| **Unit**    | Pixel                                                       |
| **Range**   | 0 (top, end of chart) – `trackHeight` (bottom, pulse 0)     |
| **Purpose** | Absolute position of a DOM element on the scrollable canvas |

```
Y = trackHeight - pulse * scaleY
pulse = (trackHeight - Y) / scaleY
```

### 2. Pulse space

| Property                                   | Value                                                           |
| ------------------------------------------ | --------------------------------------------------------------- |
| **Suffix**                                 | `Pulse` (e.g. `eventPulse`, `trimPulse`, `cursorPulse`)         |
| **Unit**                                   | Pulse (PPQN = 240)                                              |
| **Range**                                  | 0 (song start) – `chartSize`                                    |
| **Purpose**                                | Musical position on the chart. Linear in Y — each pixel spans a |
| fixed number of pulses regardless of tempo |

To Y: `Y = trackHeight - pulse * scaleY`. From Y: `pulse = (trackHeight - Y) / scaleY`.

### 3. Chart time space

| Property    | Value                                                                    |
| ----------- | ------------------------------------------------------------------------ |
| **Suffix**  | `ChartSec` (e.g. `eventChartSec`, `chartSec`)                            |
| **Unit**    | Seconds since song start (pulse 0)                                       |
| **Range**   | 0 – chart duration                                                       |
| **Purpose** | Real-time position in the song. Non-linear with pulse due to BPM changes |

```
chartSec = timingEngine.pulseToSec(pulse)     // O(log N) — binary search over BPM changes
pulse    = timingEngine.secToPulse(chartSec)  // inverse
```

---

## Waveform-extended spaces

These two additional spaces are introduced by waveform previews.
Rendering space extends the spatial end; Audio time and Waveform frame extend
the temporal end.

### 4. Rendering space

| Property    | Value                                                                 |
| ----------- | --------------------------------------------------------------------- |
| **Suffix**  | `Rp` (e.g. `rpStart`, `rpLength`, `renderingPos`)                     |
| **Unit**    | Pixel (offset from eventPulse)                                        |
| **Range**   | 0 (eventPulse, waveform start) – `rpLength` (trimPulse, waveform end) |
| **Purpose** | Position within a waveform block, counting upward from the sound      |

event's pulse toward the next event. Segments are contiguous slices:
`[0, 512)`, `[512, 1024)`, … |

Rendering space counts **earlier → later**: `rp=0` is the beginning of the audio
(at the event pulse), `rp=rpLength` is the end (at the trim pulse).

To Y: `Y = waveformBottomY - rp`. From Y: `rp = waveformBottomY - Y`.

### 5. Audio time space

| Property      | Value                                                               |
| ------------- | ------------------------------------------------------------------- |
| **Suffix**    | `AudioSec` (e.g. `audioSec`, `sampleOffsetAudioSec`)                |
| **Unit**      | Seconds since start of the audio file                               |
| **Range**     | 0 – `audioDurationSec`                                              |
| **Purpose**   | Position within a decoded audio file. Independent of chart position |
| **Stored in** | `WaveformSlice.$waveformData` (as `durationSec`)                    |

```
audioSec = chartSec - eventChartSec + sampleOffsetAudioSec
```

For `play` commands, `sampleOffsetAudioSec` is 0. For `continue`, it is the
cumulative chart time consumed by prior events in the chain (computed by
`computeWaveformOffsets()`).

### 6. Waveform frame space

| Property        | Value                                                               |
| --------------- | ------------------------------------------------------------------- |
| **Suffix**      | `Frame` (e.g. `frameStart`, `frameEnd`, `frameIndex`)               |
| **Unit**        | Frame index (120 frames/second)                                     |
| **Range**       | 0 – `frameCount`                                                    |
| **Purpose**     | Index into the `Float32Array peak[]` and `rms[]` arrays stored in   |
| `WaveformSlice` |
| **Stored in**   | `WaveformSlice.$waveformData` (as `peak` and `rms` `Float32Array`s) |

```
frame = floor(audioSec * 120)
```

---

## Naming convention

Every variable carries its space as a suffix. This makes it obvious at a glance
which coordinate system a value belongs to.

| Space          | Suffix     | Examples                                 |
| -------------- | ---------- | ---------------------------------------- |
| Timeline Y     | `Y`        | `segmentY`, `waveformBottomY`, `scrollY` |
| Rendering      | `Rp`       | `rpStart`, `rpLength`, `renderingPos`    |
| Pulse          | `Pulse`    | `eventPulse`, `trimPulse`, `cursorPulse` |
| Chart time     | `ChartSec` | `eventChartSec`, `chartSec`              |
| Audio time     | `AudioSec` | `audioSec`, `sampleOffsetAudioSec`       |
| Waveform frame | `Frame`    | `frameStart`, `frameEnd`, `framesPerSec` |

**Conversion functions** are named `toSpaceFromSpace`: `pulseToY(pulse)`,
`yToPulse(y)`, `chartSecToAudioSec(sec)`, `audioSecToFrame(sec)`.

---

## Full conversion chain

Reading left to right: rendering position flows through the spatial side (Y,
pulse), crosses into the temporal side (chart time, audio time), and lands at a
frame index.

```
Rendering      TimelineY      Pulse         ChartTime      AudioTime       Frame
  rp               Y           pulse         chartSec       audioSec        frame
  ──────→ yToRp    ──────→ yToPulse   ───→ pulseToChartSec   ───→ chartSecToAudioSec   ───→ audioSecToFrame
  ←────── rpToY    ←────── pulseToY  ←─── chartSecToPulse   ←─── audioSecToChartSec   ←─── frameToAudioSec
```

**From frame to rendering** (reverse, for reference):

```
frame → frameToAudioSec → audioSec → audioSecToChartSec → chartSec
      → chartSecToPulse → pulse → pulseToY → Y → rpToY → renderingPos
```

---

## Key invariants

1. **Earlier → later.** All computation flows from earlier (eventPulse,
   rendering 0, frame 0) toward later (trimPulse, rendering N, frame N).
   Nothing reverses direction mid-pipeline.

2. **Segments are contiguous in rendering space.** `computeWaveformSegments()`
   splits `[0, rpLength)` into ≤512-frame slices. Each segment's
   `pixelStart` is its offset from eventPulse.

3. **Segment positioning.** A segment at `[rpStart, rpStart+rpLength)` is
   placed at `Y = waveformBottomY - rpStart - rpLength` on the canvas.

4. **`getWaveformPixels()`** returns arrays in earlier→later order:
   `peak[0]` = earliest audio, `peak[N-1]` = latest. No reversal inside
   this function.

5. **Canvas reversal for display.** Only `drawWaveform()` reverses the array
   index to canvas position: it draws `peak[pixelLength - 1 - py]` at canvas
   row `py`, so the earliest audio (index 0) appears at the canvas bottom and
   the latest audio appears at the canvas top. This matches the timeline's
   bottom-to-top time flow.

---

## Code locations

| Concept                             | File                                           |
| ----------------------------------- | ---------------------------------------------- |
| Conversion chain (rendering→frame)  | `render-slice.ts:computeWaveformSlices`        |
| Segment partitioning                | `waveform-segments.ts:computeWaveformSegments` |
| Canvas drawing (display reversal)   | `waveform-renderer.ts:drawWaveform`            |
| Sound slice offsets (play/continue) | `waveform-slicer.ts:computeWaveformOffsets`    |
| Waveform data storage               | `slices/waveform-slice.ts`                     |
| Render spec generation              | `render-slice.ts:computeSpecs`                 |
| BPM-aware pulse↔seconds             | `timing-engine/index.ts`                       |
