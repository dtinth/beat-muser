/**
 * TypeBox schemas for the Beat Muser project file format.
 *
 * ## File Format Overview
 *
 * A Beat Muser project is stored as `beat-muser-project.json` in a project
 * directory. The format uses an **ECS-lite** entity model at the project level.
 *
 * ## Design Principles
 *
 * - **ECS-lite**: Entities are just `{id, version, components}`. An entity's
 *   kind is determined by the components it carries, not by a type hierarchy.
 * - **Flat**: All project data lives in a single top-level `entities` array.
 *   Charts, notes, BPM changes, sound channel definitions — everything is an
 *   entity. Relationships are expressed through reference components.
 * - **CRDT-ready**: Every entity has a UUIDv7 `id` and `version`.
 *   Merge is simple: union by `id`, higher `version` wins. Tombstones live
 *   in `deletedEntities`.
 * - **Open schema**: Component objects allow `additionalProperties: true` so
 *   plugins and game modes can attach arbitrary attributes.
 * - **Versioned**: `schemaVersion` is a number for migration support.
 *   `version` is a UUIDv7 timestamp for collaborative editing.
 *
 * ## Core Components
 *
 * The base format defines a small set of core components. Plugins may add
 * their own component names without restriction.
 *
 * | Component      | Presence implies...                                     |
 * | -------------- | ------------------------------------------------------- |
 * | `chart`        | This entity is a chart (difficulty).                    |
 * | `event`        | This entity is timed on the timeline (`y` in pulses).   |
 * | `chartRef`     | This entity belongs to a specific chart.                |
 * | `note`         | This entity is a playable note.                         |
 * | `bpmChange`    | This entity changes the BPM.                            |
 * | `sound`        | This entity is a keysound event or sound definition.    |
 * | `soundRef`     | This entity references a sound channel by UUID.         |
 *
 * ## Example Entities
 *
 * A chart:
 * ```json
 * {
 *   "id": "01H...",
 *   "version": "01H...",
 *   "components": {
 *     "chart": { "name": "Hard", "mode": "4k" }
 *   }
 * }
 * ```
 *
 * A note on that chart:
 * ```json
 * {
 *   "id": "01H...",
 *   "version": "01H...",
 *   "components": {
 *     "event": { "y": 240 },
 *     "chartRef": { "chartId": "01H..." },
 *     "note": { "lane": 0 },
 *     "soundRef": { "channelId": "01H..." }
 *   }
 * }
 * ```
 *
 * A sound channel definition (untimed):
 * ```json
 * {
 *   "id": "01H...",
 *   "version": "01H...",
 *   "components": {
 *     "soundChannel": { "name": "Kick", "path": "audio/kick.wav" }
 *   }
 * }
 * ```
 *
 * ## Merge Rule
 *
 * Entities are merged by `id`. If the same `id` exists in two versions,
 * the entity with the lexicographically higher `version` wins.
 * Deletion is represented by moving the entity to `deletedEntities` with a
 * new `version`.
 */

import { Type } from "typebox";

/**
 * UUIDv7 pattern for schema description.
 */
const UUIDv7Desc = "UUIDv7 identifier. Time-ordered, sortable, globally unique.";

/**
 * An entity is a uniquely identified object with a versioned bag of components.
 *
 * Required fields:
 * - `id`: UUIDv7 unique identifier, immutable once created.
 * - `version`: UUIDv7 revision timestamp, updated on every edit.
 * - `components`: Record of component names to component data objects.
 *
 * An entity has no `type` field. Its kind is determined by the components
 * it carries (e.g., an entity with a `chart` component is a chart).
 */
export const EntitySchema = Type.Object(
  {
    id: Type.String({
      description: UUIDv7Desc,
    }),
    version: Type.String({
      description: "UUIDv7 revision timestamp. Updated on every edit. Higher value wins on merge.",
    }),
    components: Type.Record(Type.String(), Type.Any(), {
      description:
        "ECS-style component bag. Keys are component names (e.g., 'chart', 'event', 'note'). Values are component-specific objects.",
    }),
  },
  {
    additionalProperties: false,
    description:
      "An entity is a uniquely identified object with a versioned bag of components. No 'type' field — an entity's kind is determined by its components.",
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

// ---------------------------------------------------------------------------
// Core Component Schemas
// ---------------------------------------------------------------------------

/**
 * Core component: identifies a timed event.
 *
 * Entities carrying this component appear on the timeline at the given
 * pulse position. Other components (e.g., `note`, `bpmChange`) provide
 * the specific event kind.
 */
export const EventComponentSchema = Type.Object(
  {
    y: Type.Number({
      description: "Pulse position on the timeline. PPQN = 240. 0 = song start.",
    }),
  },
  {
    additionalProperties: false,
    description:
      "Identifies a timed event. Entities with this component appear on the timeline at the given pulse position.",
  },
);

/**
 * Core component: identifies a chart (difficulty).
 */
export const ChartComponentSchema = Type.Object(
  {
    name: Type.String({
      description: 'Display name of the chart, e.g., "Hard", "Expert".',
    }),
    mode: Type.String({
      description:
        'Game mode identifier, e.g., "4k", "7k", "sdvx". Determines how related entities are interpreted.',
    }),
  },
  {
    additionalProperties: true,
    description:
      "Identifies a chart (difficulty) entity. A chart is just an entity that carries this component.",
  },
);

/**
 * Core component: links an entity to a specific chart.
 */
export const ChartRefComponentSchema = Type.Object(
  {
    chartId: Type.String({
      description: "UUID of the parent chart entity.",
    }),
  },
  {
    additionalProperties: false,
    description: "Links an entity (e.g., a note) to a specific chart.",
  },
);

/**
 * Core component: identifies a playable note.
 */
export const NoteComponentSchema = Type.Object(
  {
    lane: Type.Optional(
      Type.Number({
        description: "Lane index for lane-based modes.",
      }),
    ),
  },
  {
    additionalProperties: true,
    description: "Identifies a note entity.",
  },
);

/**
 * Core component: identifies a BPM change event.
 */
export const BpmChangeComponentSchema = Type.Object(
  {
    bpm: Type.Number({
      description: "New BPM value.",
    }),
  },
  {
    additionalProperties: false,
    description: "Identifies a BPM change event.",
  },
);

/**
 * Core component: identifies a sound event (keysound) or sound definition.
 */
export const SoundComponentSchema = Type.Object(
  {
    path: Type.String({
      description: "Relative path to the audio file (e.g., 'audio/kick.wav').",
    }),
  },
  {
    additionalProperties: true,
    description: "Identifies a sound event (keysound) or sound channel definition.",
  },
);

/**
 * Core component: references a sound channel entity by UUID.
 */
export const SoundRefComponentSchema = Type.Object(
  {
    channelId: Type.String({
      description: "UUID of the referenced sound channel entity.",
    }),
  },
  {
    additionalProperties: false,
    description: "Links a note or event to a sound channel entity.",
  },
);

// ---------------------------------------------------------------------------
// Project Metadata & Root Schema
// ---------------------------------------------------------------------------

/**
 * Project-level metadata describing the song.
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
 *   "schemaVersion": 2,
 *   "version": "01H...",
 *   "metadata": {
 *     "title": "Song Name",
 *     "artist": "Artist",
 *     "genre": "Genre"
 *   },
 *   "entities": [
 *     {
 *       "id": "01H...",
 *       "version": "01H...",
 *       "components": {
 *         "chart": { "name": "Hard", "mode": "4k" }
 *       }
 *     },
 *     {
 *       "id": "01H...",
 *       "version": "01H...",
 *       "components": {
 *         "event": { "y": 240 },
 *         "chartRef": { "chartId": "01H..." },
 *         "note": { "lane": 0 }
 *       }
 *     }
 *   ],
 *   "deletedEntities": []
 * }
 * ```
 *
 * Key details:
 * - `schemaVersion`: Number for schema migration support. Current version: 2.
 * - `version`: UUIDv7 project-level revision timestamp.
 * - `metadata`: Song-level metadata (title, artist, genre).
 * - `entities`: Flat array of all active project entities.
 * - `deletedEntities`: Array of tombstone references for deleted entities.
 * - All objects allow additional properties for plugin extensibility.
 * - Asset paths use `/` as separator and are relative to the project directory.
 * - Default BPM is 60. PPQN is 240 (bmson standard).
 *
 * ## Merge Rule
 * Merge two project versions by unioning `id`s:
 * - Entities: higher `version` wins. Deleted entities go to `deletedEntities`.
 * - No special cases — deletion is just another write with a tombstone.
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
      description: "Schema version number for migration support. Current version: 2.",
    }),
    version: Type.String({
      description: "UUIDv7 project-level revision timestamp.",
    }),
    metadata: ProjectMetadataSchema,
    entities: Type.Array(EntitySchema, {
      description: "Flat array of all active entities in the project.",
    }),
    deletedEntities: Type.Array(DeletedEntitySchema, {
      description: "Array of tombstone references for deleted entities.",
    }),
  },
  {
    additionalProperties: true,
    description: "Additional top-level properties.",
  },
);
