import { atom } from "nanostores";
import { Slice } from "../slice";
import type { GameModeLayout } from "../lane-layouts";

export class GameModeRegistrySlice extends Slice {
  static readonly sliceKey = "game-mode-registry";

  /** Reactive store of all registered game modes. */
  $modes = atom<ReadonlyMap<string, GameModeLayout>>(new Map());

  private modes = new Map<string, GameModeLayout>();

  /**
   * Register a game mode layout.
   *
   * Overwrites any existing mode with the same `mode` identifier.
   * Notifies subscribers so that column layouts refresh automatically.
   */
  registerGameMode(layout: GameModeLayout): void {
    this.modes.set(layout.mode, layout);
    this.$modes.set(new Map(this.modes));
  }

  /**
   * Look up the layout for a given game mode.
   *
   * @param mode Game mode identifier, e.g. "beat-7k".
   * @returns The layout definition, or undefined if not registered.
   */
  getGameModeLayout(mode: string): GameModeLayout | undefined {
    return this.modes.get(mode);
  }

  /**
   * Get all registered game mode layouts.
   */
  getAllModes(): GameModeLayout[] {
    return Array.from(this.modes.values());
  }
}
