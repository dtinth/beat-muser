import { atom } from "nanostores";
import { Slice } from "../slice.ts";
import type { GameModeLayout } from "../lane-layouts.ts";
import type { PropertySet, ColoringRule, ExporterManifest } from "../../extensions/index.ts";
import { seedPropertyDefaults } from "../property-system.ts";
import { compileColoringRule, type CompiledColoringRule } from "../coloring-rule-system.ts";

export class GameModeRegistrySlice extends Slice {
  static readonly sliceKey = "game-mode-registry";

  /** Reactive store of all registered game modes. */
  $modes = atom<ReadonlyMap<string, GameModeLayout>>(new Map());

  private modes = new Map<string, GameModeLayout>();
  private propertySets = new Map<string, PropertySet>();
  /** Game mode → compiled coloring rules (sorted by priority desc, stable for ties). */
  private coloringRules = new Map<string, CompiledColoringRule[]>();
  private exporters: ExporterManifest[] = [];

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

  /**
   * Register a coloring rule and index it by game mode.
   */
  registerColoringRule(rule: ColoringRule): void {
    const compiled = compileColoringRule(rule);
    const modes = rule.gameModes ?? Array.from(this.modes.keys());
    for (const mode of modes) {
      const existing = this.coloringRules.get(mode) ?? [];
      existing.push(compiled);
      // Keep sorted: higher priority first, stable sort for ties
      existing.sort((a, b) => b.priority - a.priority);
      this.coloringRules.set(mode, existing);
    }
  }

  /**
   * Get compiled coloring rules for a game mode, sorted by priority descending.
   */
  getColoringRulesForMode(mode: string): CompiledColoringRule[] {
    return this.coloringRules.get(mode) ?? [];
  }

  /**
   * Register an exporter.
   */
  registerExporter(exporter: ExporterManifest): void {
    this.exporters.push(exporter);
  }

  /**
   * Get all exporters whose game modes include the given mode.
   */
  getExportersForMode(mode: string): ExporterManifest[] {
    return this.exporters.filter((e) => e.gameModes.includes(mode));
  }
}
