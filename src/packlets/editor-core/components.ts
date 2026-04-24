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
        description: 'Display name of the chart, e.g., "Hard", "Expert".',
      }),
      mode: Type.String({
        description:
          'Game mode identifier, e.g., "beat-7k", "beat-14k", "popn". Determines how related entities are interpreted.',
      }),
      size: Type.Optional(
        Type.Number({
          description:
            "Length of the chart in pulses. Default is 15360 (16 measures of 4/4 at 240 PPQN). Auto-extends when notes are placed past the end.",
        }),
      ),
    },
    {
      additionalProperties: true,
      description: "Identifies a chart (difficulty) entity.",
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
