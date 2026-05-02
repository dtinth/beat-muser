/**
 * @packageDocumentation
 *
 * Lane layout definitions for game modes.
 *
 * A lane is a gameplay column inside a level. Each game mode defines its own
 * lane layout: how many lanes, their widths, names, and background colors.
 *
 * These are raw layout definitions. The {@link GameModeRegistrySlice} is the
 * source of truth for which modes are available at runtime.
 */

export interface LaneDefinition {
  /** The lane index used in note entities, e.g. 1, 2, 8. */
  laneIndex: number;
  /** Display name of the lane, e.g. "1", "2", "SC". */
  name: string;
  /** Width of the lane in pixels. */
  width: number;
  /** Optional background color for the lane. */
  backgroundColor?: string;
  /** Color for notes placed in this lane. */
  noteColor: string;
}

export interface GameModeLayout {
  /** Game mode identifier, e.g. "beat-7k". */
  mode: string;
  /** Ordered lane definitions from left to right. */
  lanes: LaneDefinition[];
  /** Whether this mode supports linking sound channels to notes (keysounding). */
  keysounds?: boolean;
}

const BEAT_5K_LANES: LaneDefinition[] = [
  {
    laneIndex: 8,
    name: "SC",
    width: 56,
    backgroundColor: "var(--red-2)",
    noteColor: "var(--red-7)",
  },
  {
    laneIndex: 1,
    name: "1",
    width: 36,
    backgroundColor: "var(--gray-2)",
    noteColor: "var(--gray-7)",
  },
  {
    laneIndex: 2,
    name: "2",
    width: 36,
    backgroundColor: "var(--indigo-2)",
    noteColor: "var(--indigo-7)",
  },
  {
    laneIndex: 3,
    name: "3",
    width: 36,
    backgroundColor: "var(--gray-2)",
    noteColor: "var(--gray-7)",
  },
  {
    laneIndex: 4,
    name: "4",
    width: 36,
    backgroundColor: "var(--indigo-2)",
    noteColor: "var(--indigo-7)",
  },
  {
    laneIndex: 5,
    name: "5",
    width: 36,
    backgroundColor: "var(--gray-2)",
    noteColor: "var(--gray-7)",
  },
];

const BEAT_7K_LANES: LaneDefinition[] = [
  {
    laneIndex: 8,
    name: "SC",
    width: 56,
    backgroundColor: "var(--red-2)",
    noteColor: "var(--red-7)",
  },
  {
    laneIndex: 1,
    name: "1",
    width: 36,
    backgroundColor: "var(--gray-2)",
    noteColor: "var(--gray-7)",
  },
  {
    laneIndex: 2,
    name: "2",
    width: 28,
    backgroundColor: "var(--indigo-2)",
    noteColor: "var(--indigo-7)",
  },
  {
    laneIndex: 3,
    name: "3",
    width: 36,
    backgroundColor: "var(--gray-2)",
    noteColor: "var(--gray-7)",
  },
  {
    laneIndex: 4,
    name: "4",
    width: 28,
    backgroundColor: "var(--indigo-2)",
    noteColor: "var(--indigo-7)",
  },
  {
    laneIndex: 5,
    name: "5",
    width: 36,
    backgroundColor: "var(--gray-2)",
    noteColor: "var(--gray-7)",
  },
  {
    laneIndex: 6,
    name: "6",
    width: 28,
    backgroundColor: "var(--indigo-2)",
    noteColor: "var(--indigo-7)",
  },
  {
    laneIndex: 7,
    name: "7",
    width: 36,
    backgroundColor: "var(--gray-2)",
    noteColor: "var(--gray-7)",
  },
];

export const BEAT_5K_LAYOUT: GameModeLayout = {
  mode: "beat-5k",
  lanes: BEAT_5K_LANES,
  keysounds: true,
};

export const BEAT_7K_LAYOUT: GameModeLayout = {
  mode: "beat-7k",
  lanes: BEAT_7K_LANES,
  keysounds: true,
};

/**
 * Get the total width of all lanes in a layout.
 *
 * @param layout A game mode layout.
 * @returns Total lane width in pixels.
 */
export function getModeLaneWidth(layout: GameModeLayout): number {
  return layout.lanes.reduce((sum, lane) => sum + lane.width, 0);
}
