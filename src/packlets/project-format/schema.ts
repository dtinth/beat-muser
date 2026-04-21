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
 * - **Open schema**: All objects allow `additionalProperties: true` so plugins
 *   and game modes can attach arbitrary attributes without breaking validation.
 * - **Versioned**: The top-level `version` field enables future schema evolution.
 *
 * ## Entity Model (inspired by Sonolus and BMSON)
 *
 * Entities are the atomic building blocks of a chart. Each entity has:
 * - `y` — position on the timeline in pulses (PPQN = 960, default BPM = 60)
 * - `type` — a string identifying the kind of event (e.g. `"note"`, `"bpm-change"`)
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
 *   "version": 1,
 *   ...
 * }
 * ```
 */

import { Type } from "typebox";

/**
 * An entity is a single event placed on a chart timeline.
 *
 * Required fields:
 * - `y`: Pulse position on the timeline (PPQN = 960). 0 = song start.
 * - `type`: String identifying the event kind. Common types:
 *   - `"note"` — a hit note (may include `lane: number`)
 *   - `"bpm-change"` — a BPM change (includes `bpm: number`)
 *   - `"scroll-change"` — a scroll speed change (includes `speed: number`)
 *   - `"sound"` — a keysound event (includes `sound: string` path)
 *
 * Additional properties are allowed and interpreted by game mode plugins.
 * For example, a 4K mode plugin might add `lane: 0` for a note in lane 0,
 * while a chain-based mode might add `channel: "A"` to link notes together.
 *
 * Long notes use separate start and end events. Pairing strategy is
 * plugin-dependent (shared ID, lane ordering, channel, etc.).
 */
export const EntitySchema = Type.Object(
  {
    y: Type.Number({
      description: "Pulse position on the timeline. PPQN = 960. 0 = song start.",
    }),
    type: Type.String({
      description:
        'Event type identifier. Examples: "note", "bpm-change", "scroll-change", "sound".',
    }),
  },
  {
    additionalProperties: true,
    description:
      "Additional properties are plugin-specific attributes (e.g., lane, channel, bpm, sound).",
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
 * A single chart (difficulty) within a project.
 *
 * Contains:
 * - `metadata`: Chart-level metadata (name, mode, etc.)
 * - `entities`: Array of events on the chart timeline, sorted by `y`.
 *   Includes notes, BPM changes, scroll changes, sound events, etc.
 */
export const ChartSchema = Type.Object(
  {
    metadata: ChartMetadataSchema,
    entities: Type.Array(EntitySchema, {
      description: "Ordered array of timeline events. Should be sorted by `y` ascending.",
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
 *   "version": 1,
 *   "metadata": {
 *     "title": "Song Name",
 *     "artist": "Artist",
 *     "genre": "Genre"
 *   },
 *   "charts": [
 *     {
 *       "metadata": { "name": "Hard", "mode": "4k" },
 *       "entities": [
 *         { "y": 0, "type": "bpm-change", "bpm": 120 },
 *         { "y": 960, "type": "note", "lane": 0 },
 *         { "y": 1920, "type": "note", "lane": 1 }
 *       ]
 *     }
 *   ]
 * }
 * ```
 *
 * Key details:
 * - `version`: Schema version for future migration support.
 * - `metadata`: Song-level metadata (title, artist, genre).
 * - `charts`: Array of charts/difficulties, each with its own entity timeline.
 * - All objects allow additional properties for plugin extensibility.
 * - Asset paths (audio, images) use `/` as separator and are relative to the
 *   project directory. Nested subdirectories are supported.
 * - Default BPM is 60. PPQN is 960 (aligned with MIDI standard).
 */
export const ProjectFileSchema = Type.Object(
  {
    $schema: Type.Optional(
      Type.String({
        description:
          "URL to the JSON Schema for this format. Enables IDE validation and autocomplete.",
      }),
    ),
    version: Type.Number({
      description: "Schema version number. Current version: 1.",
    }),
    metadata: ProjectMetadataSchema,
    charts: Type.Array(ChartSchema, {
      description: "Array of charts/difficulties. A project may contain multiple charts.",
    }),
  },
  {
    additionalProperties: true,
    description: "Additional top-level properties.",
  },
);
