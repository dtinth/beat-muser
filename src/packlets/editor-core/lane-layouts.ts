/**
 * @packageDocumentation
 *
 * Lane layout interfaces for game modes. The built-in beat mode layouts
 * live in {@link extensions} as a built-in extension.
 *
 * A lane is a gameplay column inside a level. Each game mode defines its own
 * lane layout: how many lanes, their widths, names, and background colors.
 *
 * The {@link GameModeRegistrySlice} is the source of truth for which modes
 * are available at runtime.
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

/**
 * Get the total width of all lanes in a layout.
 *
 * @param layout A game mode layout.
 * @returns Total lane width in pixels.
 */
export function getModeLaneWidth(layout: GameModeLayout): number {
  return layout.lanes.reduce((sum, lane) => sum + lane.width, 0);
}
