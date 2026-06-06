import { describe, expect, test } from "vite-plus/test";
import { compileQuery, compileColoringRule, findMatchingRule } from "./coloring-rule-system.ts";
import type { ColoringRule } from "../extensions/index.ts";

describe("compileQuery", () => {
  test("matches simple equality", () => {
    const match = compileQuery({ fingerId: 0 });
    expect(match({ fingerId: 0 })).toBe(true);
    expect(match({ fingerId: 1 })).toBe(false);
    expect(match({})).toBe(false);
  });

  test("matches $in operator", () => {
    const match = compileQuery({ noteType: { $in: ["tap", "drag"] } });
    expect(match({ noteType: "tap" })).toBe(true);
    expect(match({ noteType: "drag" })).toBe(true);
    expect(match({ noteType: "flick" })).toBe(false);
  });

  test("matches $and composition", () => {
    const match = compileQuery({ $and: [{ fingerId: 0 }, { noteType: { $in: ["tap", "drag"] } }] });
    expect(match({ fingerId: 0, noteType: "tap" })).toBe(true);
    expect(match({ fingerId: 0, noteType: "drag" })).toBe(true);
    expect(match({ fingerId: 1, noteType: "tap" })).toBe(false);
  });

  test("matches $or composition", () => {
    const match = compileQuery({ $or: [{ fingerId: 0 }, { noteType: "flick" }] });
    expect(match({ fingerId: 0, noteType: "tap" })).toBe(true);
    expect(match({ fingerId: 1, noteType: "flick" })).toBe(true);
    expect(match({ fingerId: 1, noteType: "tap" })).toBe(false);
  });

  test("matches $not negation", () => {
    const match = compileQuery({ fingerId: { $not: { $eq: 0 } } });
    expect(match({ fingerId: 1 })).toBe(true);
    expect(match({ fingerId: 0 })).toBe(false);
  });

  test("matches nested dot-notation paths", () => {
    const match = compileQuery({ "note.lane": { $gte: 4 } });
    expect(match({ note: { lane: 5 } })).toBe(true);
    expect(match({ note: { lane: 3 } })).toBe(false);
  });
});

describe("compileColoringRule", () => {
  test("produces a CompiledColoringRule from a ColoringRule definition", () => {
    const rule: ColoringRule = {
      id: "finger-0",
      priority: 100,
      match: { fingerId: 0 },
      apply: { noteColor: "#ff0000" },
    };
    const compiled = compileColoringRule(rule);
    expect(compiled.id).toBe("finger-0");
    expect(compiled.priority).toBe(100);
    expect(compiled.apply).toEqual({ noteColor: "#ff0000" });
    expect(compiled.matches({ fingerId: 0 })).toBe(true);
    expect(compiled.matches({ fingerId: 1 })).toBe(false);
  });
});

describe("findMatchingRule", () => {
  const r1 = compileColoringRule({
    id: "a",
    priority: 100,
    match: { fingerId: 0 },
    apply: { noteColor: "red" },
  });
  const r2 = compileColoringRule({
    id: "b",
    priority: 200,
    match: { fingerId: 0 },
    apply: { noteColor: "blue" },
  });
  const r3 = compileColoringRule({
    id: "c",
    priority: 200,
    match: { fingerId: 1 },
    apply: { noteColor: "green" },
  });

  test("returns the first matching rule (sorted by priority desc)", () => {
    const result = findMatchingRule([r1, r2, r3], { fingerId: 0 });
    expect(result).toEqual({ noteColor: "blue" });
  });

  test("returns null when no rule matches", () => {
    const result = findMatchingRule([r1, r2], { fingerId: 9 });
    expect(result).toBeNull();
  });

  test("on same priority, first registered wins", () => {
    const highA = compileColoringRule({
      id: "a",
      priority: 100,
      match: { fingerId: 0 },
      apply: { noteColor: "red" },
    });
    const highB = compileColoringRule({
      id: "b",
      priority: 100,
      match: { fingerId: 0 },
      apply: { noteColor: "blue" },
    });
    const result = findMatchingRule([highA, highB], { fingerId: 0 });
    expect(result).toEqual({ noteColor: "red" });
  });
});
