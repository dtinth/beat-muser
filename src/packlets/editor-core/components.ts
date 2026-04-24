/**
 * @packageDocumentation
 *
 * Component type definitions for the beatmap editor.
 *
 * Each component bundles a TypeBox schema (for documentation and potential
 * runtime validation) with a strongly typed `EntityComponentType` handle for
 * ECS queries.
 */

import { Type } from "typebox";
import { EntityComponentType } from "../entity-manager";

export const EVENT = new EntityComponentType(
  "event",
  Type.Object(
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
  ),
);

export const CHART = new EntityComponentType(
  "chart",
  Type.Object(
    {
      name: Type.String({
        description: 'Display name of the chart, e.g., "Main Song".',
      }),
      size: Type.Optional(
        Type.Number({
          description:
            "Length of the chart in pulses. Default is 15360 (16 measures of 4/4 at 240 PPQN). Auto-extends when notes are placed past the end.",
        }),
      ),
      soundLanes: Type.Optional(
        Type.Number({
          description: "Number of sound lanes on this chart. Default is 1.",
        }),
      ),
    },
    {
      additionalProperties: true,
      description: "Identifies a chart (timeline) entity.",
    },
  ),
);

export const BPM_CHANGE = new EntityComponentType(
  "bpmChange",
  Type.Object(
    {
      bpm: Type.Number({
        description: "New BPM value.",
      }),
    },
    {
      additionalProperties: false,
      description: "Identifies a BPM change event.",
    },
  ),
);

export const TIME_SIGNATURE = new EntityComponentType(
  "timeSignature",
  Type.Object(
    {
      numerator: Type.Number({
        description: "Top number of the time signature (e.g., 3 for 3/4).",
      }),
      denominator: Type.Number({
        description: "Bottom number of the time signature (e.g., 4 for 3/4).",
      }),
    },
    {
      additionalProperties: false,
      description: "Identifies a time signature event. Interrupts the current measure immediately.",
    },
  ),
);

export const CHART_REF = new EntityComponentType(
  "chartRef",
  Type.Object(
    {
      chartId: Type.String({
        description: "UUID of the chart this entity belongs to.",
      }),
    },
    {
      additionalProperties: false,
      description: "Ties an entity to a specific chart (timeline).",
    },
  ),
);

export const LEVEL_REF = new EntityComponentType(
  "levelRef",
  Type.Object(
    {
      levelId: Type.String({
        description: "UUID of the level this entity belongs to.",
      }),
    },
    {
      additionalProperties: false,
      description: "Ties an entity to a specific level (playable difficulty).",
    },
  ),
);

export const LEVEL = new EntityComponentType(
  "level",
  Type.Object(
    {
      name: Type.String({
        description: 'Display name of the level, e.g., "Easy", "Hard".',
      }),
      mode: Type.String({
        description:
          'Game mode identifier, e.g., "beat-7k", "beat-14k", "popn-5k", "popn-9k". Determines lane layout.',
      }),
      sortOrder: Type.Number({
        description: "Order within the parent chart. Lower values appear first.",
      }),
    },
    {
      additionalProperties: true,
      description: "Identifies a playable level (difficulty) entity.",
    },
  ),
);

export const NOTE = new EntityComponentType(
  "note",
  Type.Object(
    {
      lane: Type.Number({
        description: "Lane index within the level's mode layout. 0 = leftmost lane.",
      }),
    },
    {
      additionalProperties: false,
      description: "Identifies a playable note.",
    },
  ),
);

export const KEYSOUND = new EntityComponentType(
  "keysound",
  Type.Object(
    {
      soundLane: Type.Number({
        description:
          "Sound lane index on the chart. The note is matched with the sound event at the same pulse position in this lane.",
      }),
    },
    {
      additionalProperties: false,
      description: "Makes a note keysounded by referencing a chart sound lane.",
    },
  ),
);

export const SOUND_GROUP = new EntityComponentType(
  "soundGroup",
  Type.Object(
    {
      name: Type.String({
        description: "Display name of the sound group.",
      }),
      color: Type.Optional(
        Type.String({
          description: "Optional color for visual grouping.",
        }),
      ),
    },
    {
      additionalProperties: true,
      description: "Groups related sound channels together.",
    },
  ),
);

export const SOUND_CHANNEL = new EntityComponentType(
  "soundChannel",
  Type.Object(
    {
      name: Type.String({
        description: "Display name of the sound channel.",
      }),
      path: Type.String({
        description: "File path relative to the project directory.",
      }),
      soundGroupId: Type.Optional(
        Type.String({
          description: "UUID of the parent sound group, if any.",
        }),
      ),
    },
    {
      additionalProperties: true,
      description: "A single sound file that can be triggered by sound events.",
    },
  ),
);

export const SOUND_EVENT = new EntityComponentType(
  "soundEvent",
  Type.Object(
    {
      soundLane: Type.Number({
        description: "Sound lane index on the chart where this event appears.",
      }),
      soundChannelId: Type.String({
        description: "UUID of the sound channel to trigger.",
      }),
      command: Type.Union([Type.Literal("play"), Type.Literal("continue")], {
        description: "Whether to play from the beginning or continue from the previous slice.",
      }),
    },
    {
      additionalProperties: false,
      description: "Triggers a sound channel on a chart's sound lane.",
    },
  ),
);
