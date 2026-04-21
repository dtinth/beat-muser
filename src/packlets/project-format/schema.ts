/**
 * TypeBox schemas for the Beat Muser project file format.
 *
 * ## File Format Overview
 *
 * A Beat Muser project is stored as `beat-muser-project.json` in a project
 * directory. The format is event-driven (like MIDI) and uses **pulses** as
 * the timeline unit, with a default PPQN (pulses per quarter note) of 960.
 *
 * ## Design Principles
 *
 * - **Event-based**: All timeline items (notes, BPM changes, scroll changes,
 *   sound events) are stored as `Entity` records with a `y` (pulse position)
 *   and a `type` string.
 * - **CRDT-ready**: Every entity and chart has a UUIDv7 `id` and `version`.
 *   Merge is simple: union by `id`, higher `version` wins. Tombstones live
 *   in separate `deletedEntities`/`deletedCharts` arrays.
 * - **Open schema**: All objects allow `additionalProperties: true` so plugins
 *   and game modes can attach arbitrary attributes without breaking validation.
 * - **Versioned**: `schemaVersion` is a number for migration support.
 *   `version` is a UUIDv7 timestamp for collaborative editing.
 *
 * ## Entity Model (inspired by Sonolus and BMSON)
 *
 * Entities are the atomic building blocks of a chart. Each entity has:
 * - `id` — UUIDv7 unique identifier, immutable once created
 * - `y` — position on the timeline in pulses (PPQN = 960, default BPM = 60)
 * - `type` — a string identifying the kind of event (e.g. `"note"`, `"bpm-change"`)
 * - `version` — UUIDv7 revision timestamp, updated on every edit
 * - Additional properties — plugin-specific attributes like `lane`, `channel`,
 *   `bpm`, `sound`, etc.
 *
 * Long notes are represented as separate start/end events. How they are paired
 * (shared ID, implicit lane ordering, channel chaining) is determined by the
 * game mode plugin.
 *
 * ## JSON Schema
 *
 * These schemas can be compiled to JSON Schema for external use:
 * ```ts
 * import { Build } from "typebox/schema";
 * import { ProjectFileSchema } from "./schema";
 * const schema = Build(ProjectFileSchema);
 * // Deploy to https://beat-muser.pages.dev/schemas/beat-muser-project.schema.json
 * ```
 *
 * Consumers can then use `$schema` in their project files for IDE validation:
 * ```json
 * {
 *   "$schema": "https://beat-muser.pages.dev/schemas/beat-muser-project.schema.json",
 *   "schemaVersion": 1,
 *   ...
 * }
 * ```
 */

import { Type } from "typebox";

/**
 * UUIDv7 pattern for schema description.
 */
const UUIDv7Desc = "UUIDv7 identifier. Time-ordered, sortable, globally unique.";

/**
 * An entity is a single event placed on a chart timeline.
 *
 * Required fields:
 * - `id`: UUIDv7 unique identifier, immutable once created.
 * - `y`: Pulse position on the timeline (PPQN = 960). 0 = song start.
 * - `type`: String identifying the event kind. Common types:
 *   - `"note"` — a hit note (may include `lane: number`)
 *   - `"bpm-change"` — a BPM change (includes `bpm: number`)
 *   - `"scroll-change"` — a scroll speed change (includes `speed: number`)
 *   - `"sound"` — a keysound event (includes `sound: string` path)
 *   - `"tombstone"` — a deleted entity (preserves `y` and `id`, strips other props)
 * - `version`: UUIDv7 revision timestamp, updated on every edit.
 *
 * Additional properties are allowed and interpreted by game mode plugins.
 * For example, a 4K mode plugin might add `lane: 0` for a note in lane 0,
 * while a chain-based mode might add `channel: "A"` to link notes together.
 *
 * Long notes use separate start and end events. Pairing strategy is
 * plugin-dependent (shared ID, lane ordering, channel, etc.).
 *
 * ## Merge Rule
 * Entities are merged by `id`. If the same `id` exists in two versions,
 * the entity with the lexicographically higher `version` wins.
 * Deletion is represented by `type: "tombstone"` with a new `version`.
 */
export const EntitySchema = Type.Object(
  {
    id: Type.String({
      description: UUIDv7Desc,
    }),
    y: Type.Number({
      description: "Pulse position on the timeline. PPQN = 960. 0 = song start.",
    }),
    type: Type.String({
      description:
        'Event type identifier. Examples: "note", "bpm-change", "scroll-change", "sound". Use "tombstone" for deleted entities.',
    }),
    version: Type.String({
      description: "UUIDv7 revision timestamp. Updated on every edit. Higher value wins on merge.",
    }),
  },
  {
    additionalProperties: true,
    description:
      "Additional properties are plugin-specific attributes (e.g., lane, channel, bpm, sound).",
  },
);

/**
 * A tombstone reference for a deleted entity.
 * Only stores `id` and `version` — the entity data is stripped.
 */
export const DeletedEntitySchema = Type.Object(
  {
    id: Type.String({
      description: UUIDv7Desc,
    }),
    version: Type.String({
      description: "UUIDv7 revision timestamp at time of deletion.",
    }),
  },
  {
    additionalProperties: false,
  },
);

/**
 * Metadata describing a single chart (difficulty).
 *
 * Required fields:
 * - `name`: Display name of the chart (e.g., "Hard", "Expert")
 * - `mode`: Game mode identifier (e.g., "4k", "7k", "sdvx").
 *   The mode determines how entities are interpreted.
 *
 * Additional properties are allowed for mode-specific configuration
 * (e.g., `difficulty: 12`, `rating: "★10"`).
 */
export const ChartMetadataSchema = Type.Object(
  {
    name: Type.String({
      description: 'Display name of the chart, e.g., "Hard", "Expert".',
    }),
    mode: Type.String({
      description:
        'Game mode identifier, e.g., "4k", "7k", "sdvx". Determines entity interpretation.',
    }),
  },
  {
    additionalProperties: true,
    description: "Additional properties for mode-specific configuration.",
  },
);

/**
 * A tombstone reference for a deleted chart.
 * Only stores `id` and `version` — the chart data is stripped.
 */
export const DeletedChartSchema = Type.Object(
  {
    id: Type.String({
      description: UUIDv7Desc,
    }),
    version: Type.String({
      description: "UUIDv7 revision timestamp at time of deletion.",
    }),
  },
  {
    additionalProperties: false,
  },
);

/**
 * A single chart (difficulty) within a project.
 *
 * Contains:
 * - `id`: UUIDv7 unique identifier, immutable once created.
 * - `version`: UUIDv7 revision timestamp, updated on every edit.
 * - `metadata`: Chart-level metadata (name, mode, etc.)
 * - `entities`: Array of active events on the chart timeline, sorted by `y`.
 *   Includes notes, BPM changes, scroll changes, sound events, etc.
 * - `deletedEntities`: Array of tombstone references for deleted entities.
 *
 * ## Merge Rule
 * Charts are merged by `id`. If the same `id` exists in two versions,
 * the chart with the lexicographically higher `version` wins.
 * Deletion moves the chart to `deletedCharts` with a new `version`.
 */
export const ChartSchema = Type.Object(
  {
    id: Type.String({
      description: UUIDv7Desc,
    }),
    version: Type.String({
      description: "UUIDv7 revision timestamp. Updated on every edit. Higher value wins on merge.",
    }),
    metadata: ChartMetadataSchema,
    entities: Type.Array(EntitySchema, {
      description: "Array of active timeline events. Should be sorted by `y` ascending.",
    }),
    deletedEntities: Type.Array(DeletedEntitySchema, {
      description: "Array of tombstone references for deleted entities.",
    }),
  },
  {
    additionalProperties: true,
    description: "Additional chart-level properties (e.g., per-chart audio override).",
  },
);

/**
 * Project-level metadata describing the song.
 *
 * Required fields:
 * - `title`: Song title
 * - `artist`: Artist/creator name
 * - `genre`: Music genre classification
 *
 * Additional properties are allowed for future extensibility
 * (e.g., `bpm`, `previewStart`, `cover`).
 */
export const ProjectMetadataSchema = Type.Object(
  {
    title: Type.String({
      description: "Song title.",
    }),
    artist: Type.String({
      description: "Artist or creator name.",
    }),
    genre: Type.String({
      description: "Music genre classification.",
    }),
  },
  {
    additionalProperties: true,
    description: "Additional project-level properties.",
  },
);

/**
 * The root structure of a Beat Muser project file (`beat-muser-project.json`).
 *
 * Structure:
 * ```json
 * {
 *   "$schema": "https://beat-muser.pages.dev/schemas/beat-muser-project.schema.json",
 *   "schemaVersion": 1,
 *   "version": "01H...",
 *   "metadata": {
 *     "title": "Song Name",
 *     "artist": "Artist",
 *     "genre": "Genre"
 *   },
 *   "charts": [
 *     {
 *       "id": "01H...",
 *       "version": "01H...",
 *       "metadata": { "name": "Hard", "mode": "4k" },
 *       "entities": [
 *         { "id": "01H...", "y": 0, "type": "bpm-change", "bpm": 120, "version": "01H..." },
 *         { "id": "01H...", "y": 960, "type": "note", "lane": 0, "version": "01H..." },
 *         { "id": "01H...", "y": 1920, "type": "note", "lane": 1, "version": "01H..." }
 *       ],
 *       "deletedEntities": []
 *     }
 *   ],
 *   "deletedCharts": []
 * }
 * ```
 *
 * Key details:
 * - `schemaVersion`: Number for schema migration support.
 * - `version`: UUIDv7 project-level revision timestamp.
 * - `metadata`: Song-level metadata (title, artist, genre).
 * - `charts`: Array of charts/difficulties, each with its own entity timeline.
 * - `deletedCharts`: Array of tombstone references for deleted charts.
 * - All objects allow additional properties for plugin extensibility.
 * - Asset paths (audio, images) use `/` as separator and are relative to the
 *   project directory. Nested subdirectories are supported.
 * - Default BPM is 60. PPQN is 960 (aligned with MIDI standard).
 *
 * ## Merge Rule
 * Merge two project versions by unioning `id`s at each level:
 * - Charts: higher `version` wins. Deleted charts go to `deletedCharts`.
 * - Entities: higher `version` wins. Deleted entities go to `deletedEntities`.
 * - No special cases — deletion is just another write with `type: "tombstone"`.
 */
export const ProjectFileSchema = Type.Object(
  {
    $schema: Type.Optional(
      Type.String({
        description:
          "URL to the JSON Schema for this format. Enables IDE validation and autocomplete.",
      }),
    ),
    schemaVersion: Type.Number({
      description: "Schema version number for migration support. Current version: 1.",
    }),
    version: Type.String({
      description: "UUIDv7 project-level revision timestamp.",
    }),
    metadata: ProjectMetadataSchema,
    charts: Type.Array(ChartSchema, {
      description: "Array of charts/difficulties. A project may contain multiple charts.",
    }),
    deletedCharts: Type.Array(DeletedChartSchema, {
      description: "Array of tombstone references for deleted charts.",
    }),
  },
  {
    additionalProperties: true,
    description: "Additional top-level properties.",
  },
);
