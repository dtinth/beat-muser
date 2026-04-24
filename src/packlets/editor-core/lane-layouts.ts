/**
 * @packageDocumentation
 *
 * Lane layout definitions for game modes.
 *
 * A lane is a gameplay column inside a level. Each game mode defines its own
 * lane layout: how many lanes, their widths, names, and background colors.
 */

export interface LaneDefinition {
  /** Display name of the lane, e.g. "1", "2", "SC". */
  name: string;
  /** Width of the lane in pixels. */
  width: number;
  /** Optional background color for the lane. */
  backgroundColor?: string;
}

export interface GameModeLayout {
  /** Game mode identifier, e.g. "beat-7k". */
  mode: string;
  /** Ordered lane definitions from left to right. */
  lanes: LaneDefinition[];
}

const BEAT_7K_LANES: LaneDefinition[] = [
  { name: "1", width: 32, backgroundColor: "#ffffff" },
  { name: "2", width: 24, backgroundColor: "#111111" },
  { name: "3", width: 32, backgroundColor: "#ffffff" },
  { name: "4", width: 24, backgroundColor: "#111111" },
  { name: "5", width: 32, backgroundColor: "#ffffff" },
  { name: "6", width: 24, backgroundColor: "#111111" },
  { name: "7", width: 32, backgroundColor: "#ffffff" },
  { name: "SC", width: 40, backgroundColor: "#f59e0b" },
];

const GAME_MODE_LAYOUTS: Record<string, GameModeLayout> = {
  "beat-7k": { mode: "beat-7k", lanes: BEAT_7K_LANES },
};

/**
 * Look up the lane layout for a given game mode.
 *
 * @param mode Game mode identifier, e.g. "beat-7k".
 * @returns The layout definition, or undefined if the mode is not known.
 */
export function getGameModeLayout(mode: string): GameModeLayout | undefined {
  return GAME_MODE_LAYOUTS[mode];
}

/**
 * Get the total width of all lanes in a mode.
 *
 * @param mode Game mode identifier, e.g. "beat-7k".
 * @returns Total lane width in pixels, or 0 if mode is unknown.
 */
export function getModeLaneWidth(mode: string): number {
  const layout = getGameModeLayout(mode);
  if (!layout) return 0;
  return layout.lanes.reduce((sum, lane) => sum + lane.width, 0);
}
