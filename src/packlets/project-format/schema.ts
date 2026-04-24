/**
 * @packageDocumentation
 *
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
 *   their own component names without restriction.
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
 *     "note": { "lane": 0 }
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
import { EntitySchema } from "../entity-manager";

const UUIDv7Desc = "UUIDv7 identifier. Time-ordered, sortable, globally unique.";

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
