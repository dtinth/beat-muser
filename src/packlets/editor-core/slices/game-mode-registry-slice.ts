import { atom } from "nanostores";
import { Slice } from "../slice.ts";
import type { GameModeLayout } from "../lane-layouts.ts";
import type { PropertySet } from "../../extensions/index.ts";
import { seedPropertyDefaults } from "../property-system.ts";

export class GameModeRegistrySlice extends Slice {
  static readonly sliceKey = "game-mode-registry";

  /** Reactive store of all registered game modes. */
  $modes = atom<ReadonlyMap<string, GameModeLayout>>(new Map());

  private modes = new Map<string, GameModeLayout>();
  private propertySets = new Map<string, PropertySet>();

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

  /**
   * Register a property set for a game mode. Seeds default property values
   * if no user-set values exist yet.
   */
  registerPropertySet(id: string, propertySet: PropertySet): void {
    this.propertySets.set(id, propertySet);
    seedPropertyDefaults(propertySet);
  }

  /**
   * Look up a property set by ID.
   */
  getPropertySet(id: string): PropertySet | undefined {
    return this.propertySets.get(id);
  }

  /**
   * Get all property sets referenced by a game mode.
   */
  getPropertySetsForMode(mode: string): PropertySet[] {
    const layout = this.modes.get(mode);
    if (!layout?.propertySets) return [];
    const result: PropertySet[] = [];
    for (const id of layout.propertySets) {
      const ps = this.propertySets.get(id);
      if (ps) result.push(ps);
    }
    return result;
  }
}
