# Beat Muser

[![Tests](https://dtinth.github.io/beat-muser/badge-tests.svg)](https://dtinth.github.io/beat-muser/allure/)
[![Playwright](https://dtinth.github.io/beat-muser/badge-playwright.svg)](https://dtinth.github.io/beat-muser/playwright/)
[![Packlets](https://dtinth.github.io/beat-muser/badge-packlets.svg)](https://dtinth.github.io/beat-muser/)
[![Coverage](https://dtinth.github.io/beat-muser/badge-coverage.svg)](https://dtinth.github.io/beat-muser/coverage/)

Rhythm game notechart/beatmap editor.

## Domain Model

### Core Concepts

- **Project** — A container of entities. Sound channels are global and shared across all charts.
- **Chart** — A timeline of musical events. A chart owns BPM changes, time signatures, measure structure, and sound lanes. Multiple levels can exist on the same chart.
- **Level** — A playable difficulty within a chart. Each level has a game mode (e.g. `beat-7k`), a name, and a `sortOrder`. Levels are ordered within their parent chart. Levels may also contain their own gimmick events (e.g. scroll speed changes) that do not affect other levels on the same chart.
- **Column** — A horizontal region on the timeline that visualizes one aspect: measure numbers, BPM changes, time signatures, sound lanes, or gameplay lanes.
- **Lane** — A gameplay column inside a level. A level's mode determines how many lanes it has and what they represent.
- **Sound Group** — A named grouping of sound channels, optionally with a color.
- **Sound Channel** — A single sound file that can be played. Equivalent to bmson's `soundChannel`. Starting a new sound in the same channel cuts off the previous one.
- **Sound Event** — A timed event on a chart's sound lane that triggers a sound channel to play or continue. Creates an audio slice based on the sequence of play/continue events.
- **Keysound** — A note that references a sound lane. At playback, the note is matched with the sound event at the same pulse position in that lane.

### Relationships

```
Project
├── Sound Group
│   └── Sound Channel
├── Chart
│   ├── BPM changes (chartRef)
│   ├── Time signatures (chartRef)
│   ├── Sound events (chartRef)
│   └── Level (chartRef)
│       ├── Notes (levelRef + chartRef + optional keysound)
│       └── Gimmick events (levelRef + chartRef)
```

- One project has many charts.
- One project has many sound groups; one sound group has many sound channels.
- One chart has many levels, ordered by `sortOrder`.
- One chart has many timing events (BPM changes, time signatures) referenced via `chartRef`.
- One chart has many sound events on its sound lanes.
- One level has many notes referenced via `levelRef`.
- One level may have gimmick events (e.g. scroll speed) referenced via `levelRef`.
- Every note also carries a `chartRef` for direct access to its timeline.
- A note may carry a `keysound` component referencing a sound lane.

### Design Rationale

**Three levels of structure: project, chart, and level.**

Most conventional editors (e.g. BMS editors) treat each difficulty as a separate file. A BMS file for Easy, another for Normal, another for Hard. Each file repeats the same BPM changes, time signatures, and sound definitions. If you fix a sound file error in Easy, you must remember to fix it in Normal and Hard too.

Beat Muser uses a single project file (`beat-muser-project.json`) that encompasses everything. This three-level structure keeps shared data in one place:

- **Project** owns global assets like sound channels and sound groups.
- **Chart** owns the musical timeline: BPM changes, time signatures, measure structure, and sound events on sound lanes.
- **Level** owns the playable notes for one difficulty. Multiple levels can live on the same chart, all sharing the same timing and sound events.

When you update a sound channel in the project, every level that references it hears the change immediately. When you add a sound event to a sound lane, every level can reference it. When a long song is split into distinct pieces, each piece gets its own chart with its own levels.

### Primer for Rhythm Game Chart Authors

If you have used BMS editors or similar tools, some concepts here may feel unfamiliar.

**Sound is separate from gameplay.**

In traditional editors, a note often carries the sound file directly. To make a note keysounded, you drag a sound from a BGM column into a playable column. This makes it easy to accidentally move or break the music while editing the chart.

In Beat Muser, sound events live on **sound lanes** attached to the chart, completely separate from gameplay notes. A note becomes keysounded by referencing a sound lane number. At playback, the engine looks up the sound event at the same pulse position in that lane. The underlying sound events never move — the note simply points to them.

**Sound channels and slicing.**

A sound channel represents one audio file. When you place sound events on a lane, you use two commands:

- **Play** — Start playing the sound file from the beginning.
- **Continue** — Keep playing the sound file from where the previous event left off.

A sequence of `play` followed by `continue` events slices the sound file into segments. For example, if a sound channel has events at pulses 960 (play), 1200 (continue), 1440 (continue), and 1680 (play), the audio is sliced as:

- Pulse 960: play seconds 0–1
- Pulse 1200: play seconds 1–2
- Pulse 1440: play seconds 2–3
- Pulse 1680: play seconds 0 to end of sample

This lets you reuse a single sound file as multiple keysounds without duplicating the file.

**Why not assign sounds directly to notes?**

Because a chart is a timeline of musical events, and gameplay is just one view of that timeline. Keeping sound events on their own lanes means you can compose the song first, then map gameplay to it, without ever risking the music.

### Entity Model

Beat Muser uses an ECS-lite architecture. Everything is an entity with a UUIDv7 `id` and `version`. An entity's kind is determined by the components it carries.

| Entity kind    | Components                              | Purpose                                              |
| -------------- | --------------------------------------- | ---------------------------------------------------- |
| Chart          | `chart`                                 | Timeline with `name`, `size`, and `soundLanes`       |
| Level          | `level`, `chartRef`                     | Playable difficulty with `name`, `mode`, `sortOrder` |
| Note           | `event`, `note`, `levelRef`, `chartRef` | A placed note with `lane` index                      |
| BPM change     | `event`, `bpmChange`, `chartRef`        | BPM change at a pulse position                       |
| Time signature | `event`, `timeSignature`, `chartRef`    | Time signature at a pulse position                   |
| Sound group    | `soundGroup`                            | Named group with optional `color`                    |
| Sound channel  | `soundChannel`                          | Audio file with `name`, `path`, and `soundGroupId`   |
| Sound event    | `event`, `soundEvent`, `chartRef`       | Trigger a sound channel to play or continue          |

- `event` gives a timed entity its pulse position (`y`).
- `chartRef` ties an entity to a specific chart.
- `levelRef` ties an entity to a specific level.
- A note may also carry a `keysound` component with a `soundLane` number.
- Components allow `additionalProperties` for extensibility.

## Development

See [`AGENTS.md`](./AGENTS.md) for project conventions, commands, and architecture.
