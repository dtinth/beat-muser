/**
 * @packageDocumentation
 *
 * Current property values for the extension property system.
 *
 * The atom holds "sticky" values per property key — seeded from manifest
 * defaults, updated by the property inspector. These values are injected as
 * entity components when placing new gameplay entities.
 *
 * The atom is a flat map: `{ fingerId: 0, curve: 0 }`. Values persist for
 * the lifetime of the editor page session (not across reloads).
 */

import { atom, type WritableAtom } from "nanostores";
import type { PropertySet } from "../extensions/index.ts";

/** Flat map of property key → value for the current editing session. */
export const $currentPropertyValues: WritableAtom<Record<string, unknown>> = atom({});

/**
 * Seed defaults from a property set. Only writes keys that don't already
 * have a value (so user-set values survive property set re-registration).
 */
export function seedPropertyDefaults(propertySet: PropertySet): void {
  const current = $currentPropertyValues.get();
  let changed = false;
  const next = { ...current };
  for (const [key, def] of Object.entries(propertySet.properties)) {
    if (!(key in next)) {
      next[key] = def.default;
      changed = true;
    }
  }
  if (changed) $currentPropertyValues.set(next);
}

/**
 * Get the current value for a property key, falling back to the default
 * from a property set if no value has been set yet.
 */
export function getPropertyValue(key: string, propertySets: PropertySet[]): unknown {
  const current = $currentPropertyValues.get();
  if (key in current) return current[key];
  for (const ps of propertySets) {
    const def = ps.properties[key];
    if (def !== undefined) return def.default;
  }
  return undefined;
}

/**
 * Set the current value for a property key and return the new atom state.
 */
export function setPropertyValue(key: string, value: unknown): void {
  $currentPropertyValues.set({
    ...$currentPropertyValues.get(),
    [key]: value,
  });
}

/**
 * Get all current property values as a component record suitable for
 * injection into an entity's `components` map.
 *
 * Maps each property key to its target component key and value.
 */
export function getPropertyComponentsForMode(propertySets: PropertySet[]): Record<string, unknown> {
  const current = $currentPropertyValues.get();
  const components: Record<string, unknown> = {};
  for (const ps of propertySets) {
    for (const [key, def] of Object.entries(ps.properties)) {
      const value = key in current ? current[key] : def.default;
      if (value !== undefined) {
        components[def.component] = value;
      }
    }
  }
  return components;
}
