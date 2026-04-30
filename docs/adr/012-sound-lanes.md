# ADR 012: Sound Lanes

## Status

Accepted

## Context

Traditional rhythm game editors (BMS editors, etc.) assign sounds directly to notes. To make a note keysounded, you drag a sound into a playable column. This couples the musical composition to the gameplay chart — moving a note moves its sound, and editing gameplay risks breaking the music.

We need a model where:

1. Multiple difficulty levels can share the same sounds without duplication
2. The song can be composed first, then gameplay mapped to it
3. A single sound file can be sliced into multiple segments without file duplication

## Decision

Separate **sound** from **gameplay** via **sound lanes** on the chart.

### Core Concepts

| Term              | Definition                                                                                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sound Lane**    | A chart-level timeline column that holds sound events. Organizational only — lanes do not own audio channels.                                                  |
| **Sound Event**   | A timed entity (`event` + `soundEvent` + `chartRef`) on a sound lane. Triggers a sound channel to **play** or **continue**.                                    |
| **Sound Channel** | A single audio file (`soundChannel` entity). Starting a channel stops any currently-playing instance globally.                                                 |
| **Keysound**      | A note component (`keysound: { soundLane }`) that references a sound lane. At playback, the note matches the sound event at the exact same pulse on that lane. |

### Play/Continue Slicing

A sequence of `play` followed by `continue` events on the same channel slices the audio file:

- `play` at pulse 960 → starts from second 0
- `continue` at pulse 1200 → resumes where previous event left off
- `continue` at pulse 1440 → resumes again
- `play` at pulse 1680 → restarts from second 0

This lets one audio file serve as multiple keysounds without file duplication.

### Keysound Resolution Rules

1. **Exact pulse match** — A note at pulse 960 with `keysound: { soundLane: 0 }` only matches a sound event at exactly pulse 960 on lane 0. No interpolation, no "nearest event."
2. **No sound event at pulse = silent** — The note simply points to the lane; if nothing is there, nothing plays.
3. **Sound channel is global** — Channel playback is not per-lane. Starting channel X anywhere stops any playing instance of channel X.

### soundLanes Property

The `chart` component has an optional `soundLanes` number (default: 1). This controls the default number of visible sound lane columns. However, if existing sound events have `soundLane` indices beyond this boundary, the timeline **auto-extends** to accommodate them. Decreasing `soundLanes` does not hide existing events — it only changes the default for new placement.

### Overlapping Events

Multiple sound events at the same pulse on the same lane are technically invalid but **not prevented by the editor**. The timeline renders a warning indicator. Playback and export pick one deterministically (e.g., lowest entity ID). This avoids heavy validation logic in the core while still surfacing the issue to the user.

### Orphaned Events

A sound event referencing a deleted sound channel (`soundChannelId` points to nothing) renders with a warning. Playback is silent for that event.

## Consequences

- **Separation of concerns:** Composing music and mapping gameplay are independent workflows
- **Shared across levels:** All levels on the same chart share sound lanes automatically
- **CRDT-safe:** Sound events are just entities with components; merge rules apply normally
- **More entities:** A keysounded note requires a separate sound event entity, not just a note property
- **Column layout complexity:** Timeline has three column types (timing, gameplay, sound) with spacers between sections

## References

- `src/packlets/editor-core/components.ts` — `SOUND_EVENT`, `SOUND_CHANNEL`, `SOUND_GROUP`, `KEYSOUND` components
- `src/packlets/editor-core/slices/sound-columns-slice.ts` — sound lane column provider
- `src/packlets/editor-core/slices/render-slice.ts` — sound event rendering
- `README.md` — Domain Model section
