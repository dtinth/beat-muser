/**
 * @packageDocumentation
 *
 * Type definitions for the extension system. Extracted to a separate file
 * to avoid circular imports between index.ts and worker-extension.ts.
 */

import type { GameModeLayout } from "../editor-core/lane-layouts.ts";

export interface ExtensionManifest {
  id: string;
  name: string;
  version: string;
}

export interface PropertyDefinition {
  /** Component key in entity.components that this property targets. */
  component: string;
  /** Default value when no value has been set yet. */
  default: unknown;
  /** Display label shown in the property inspector. */
  label: string;
  /** Optional UI configuration for the inspector control. */
  ui?: {
    /** Control type. Defaults to "text" if not specified. */
    control?: "text" | "number" | "segmented" | "slider" | "select";
    /** Options for segmented/select controls. */
    options?: { value: unknown; label: string }[];
    /** Min value for number/slider controls. */
    min?: number;
    /** Max value for number/slider controls. */
    max?: number;
    /** Step value for number/slider controls. */
    step?: number;
  };
}

export interface PropertySet {
  /** Display label for the property set in the inspector. */
  label: string;
  /** Map of property key to property definition. */
  properties: Record<string, PropertyDefinition>;
}

export interface ColoringRule {
  /** Unique rule identifier within the extension. */
  id: string;
  /** Priority: higher values override lower. Ties break by registration order. */
  priority: number;
  /** MongoDB-style query against entity.components. */
  match: Record<string, unknown>;
  /** Formatting to apply when matched. */
  apply: {
    /** CSS color value to use for the note. */
    noteColor: string;
  };
  /** Game mode IDs this rule applies to. If omitted, applies to all modes in the extension. */
  gameModes?: string[];
}

export interface Extension {
  readonly manifest: ExtensionManifest;
  connect(host: ExtensionHost): void;
}

export interface ExtensionHost {
  registerGameMode(layout: GameModeLayout): void;
  registerPropertySet(id: string, propertySet: PropertySet): void;
  registerColoringRule(rule: ColoringRule): void;
  /** Apply a property value: updates the sticky atom and writes to selected entities. */
  applyProperty(key: string, value: unknown): void;
  /** Register a command in the global command registry. */
  registerCommand(command: {
    id: string;
    title: string;
    shortcut?: string;
    execute: () => void;
  }): () => void;
}
