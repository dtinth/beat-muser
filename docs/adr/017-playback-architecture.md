# Playback Architecture — Lookahead Scheduler with Playback Contract

Sound event playback uses a lookahead scheduler pattern split across three layers: a `playback-contract` packlet defining shared interfaces, a `createPlayback` function in editor-core that produces scheduleable event lists in chart time, and an extended `audio-engine` that manages `AudioContext` scheduling, buffer caching, and rate conversion. The existing `AudioContext` (never destroyed) is shared between waveform decoding and playback.

## Considered Options

- **Pre-render to buffer** — simpler but blocks real-time mute/solo, requires re-render on any change.
- **HTMLAudioElement per file** — no sample-accurate scheduling, can't cut/continue precisely.
- **Separate AudioContext for playback** — cleaner lifecycle but duplicates decode work and memory.
- **Tone.js** — adds heavyweight dependency; our use case is narrow enough that raw Web Audio API is sufficient.

## Consequences

- `playback-contract` is a neutral packlet imported by both `editor-core` and `audio-engine`.
- `createPlayback` is pure and testable: given sound events + timing engine + cursor pulse, it returns a `Playback` with `getEvents(lookaheadPlaybackSec)`.
- Audio engine converts playback time to context time via `startContextTime + triggerPlaybackSec / rate` for scheduling, and sets `source.playbackRate = rate` so audio plays slower/faster accordingly.
