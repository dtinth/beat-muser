import { describe, expect, test, beforeEach } from "vite-plus/test";
import type { PropertySet } from "../extensions/index.ts";
import {
  $currentPropertyValues,
  seedPropertyDefaults,
  setPropertyValue,
  getPropertyValue,
  getPropertyComponentsForMode,
} from "./property-system.ts";

const tapNoteSet: PropertySet = {
  label: "Tap Note",
  properties: {
    fingerId: {
      component: "fingerId",
      default: 0,
      label: "Finger",
    },
    noteType: {
      component: "noteType",
      default: "tap",
      label: "Type",
    },
  },
};

beforeEach(() => {
  $currentPropertyValues.set({});
});

describe("seedPropertyDefaults", () => {
  test("seeds defaults for keys not yet in the atom", () => {
    seedPropertyDefaults(tapNoteSet);
    expect($currentPropertyValues.get()).toEqual({ fingerId: 0, noteType: "tap" });
  });

  test("does NOT overwrite existing keys", () => {
    $currentPropertyValues.set({ noteType: "drag" });
    seedPropertyDefaults(tapNoteSet);
    expect($currentPropertyValues.get()).toEqual({ noteType: "drag", fingerId: 0 });
  });
});

describe("setPropertyValue", () => {
  test("sets a value in the atom", () => {
    setPropertyValue("fingerId", 2);
    expect($currentPropertyValues.get()).toEqual({ fingerId: 2 });
  });

  test("overwrites an existing value", () => {
    $currentPropertyValues.set({ fingerId: 0 });
    setPropertyValue("fingerId", 3);
    expect($currentPropertyValues.get()).toEqual({ fingerId: 3 });
  });
});

describe("getPropertyValue", () => {
  test("returns the current value when present", () => {
    $currentPropertyValues.set({ fingerId: 2 });
    expect(getPropertyValue("fingerId", [tapNoteSet])).toBe(2);
  });

  test("falls back to property set default when no current value", () => {
    expect(getPropertyValue("fingerId", [tapNoteSet])).toBe(0);
  });

  test("returns undefined when key not found in any property set", () => {
    expect(getPropertyValue("nonexistent", [tapNoteSet])).toBeUndefined();
  });
});

describe("getPropertyComponentsForMode", () => {
  test("returns component entries for current values", () => {
    $currentPropertyValues.set({ fingerId: 1 });
    const components = getPropertyComponentsForMode([tapNoteSet]);
    expect(components).toEqual({ fingerId: 1, noteType: "tap" });
  });

  test("uses defaults when no current value", () => {
    const components = getPropertyComponentsForMode([tapNoteSet]);
    expect(components).toEqual({ fingerId: 0, noteType: "tap" });
  });

  test("omits properties with undefined default and no current value", () => {
    const set: PropertySet = {
      label: "Test",
      properties: {
        optional: {
          component: "optionalField",
          default: undefined,
          label: "Optional",
        },
      },
    };
    const components = getPropertyComponentsForMode([set]);
    expect(components).toEqual({});
  });
});
