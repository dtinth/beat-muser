# Chart Length Management — Quarter Note Display, Auto-Extend, and Minimum Clamping

Chart length is now displayed and edited in quarter notes (1 quarter note = 240 pulses) in the sidebar's Chart Info panel. The field silently clamps to a minimum of `ceil(maxEventPulse / 240)` — users cannot shrink the chart below the last event. When events are placed past the chart end, the chart auto-extends reactively (driven by `ChartSlice` watching entity mutation): if the event is within 4 quarter notes of the end, the chart grows by exactly 16 quarter notes; otherwise it rounds up to the nearest 16-quarter-note boundary.

## Considered Options

- **Number of pulses** — more precise but less musical; quarter notes are the natural unit for composers.
- **Warning dialog on shrink** — adds unnecessary friction; silent clamp is simpler and matches user expectation.
- **No auto-extend (clamp placement)** — forces users to manually resize before placing events past the end, which breaks flow.
- **Auto-extend in pointer-interaction-slice** — coupled to the pencil tool; reactive approach via mutation subscription handles all event sources (pencil, drag, future import tools) uniformly.
