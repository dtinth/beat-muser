/**
 * @packageDocumentation
 *
 * Unit tests for the ECS entity manager.
 */

import { describe, expect, test } from "vite-plus/test";
import { Type } from "typebox";
import { EntityManager, EntityComponentType } from "./index";

const Position = new EntityComponentType(
  "position",
  Type.Object({ x: Type.Number(), y: Type.Number() }),
);

const Velocity = new EntityComponentType(
  "velocity",
  Type.Object({ dx: Type.Number(), dy: Type.Number() }),
);

function makeEntity(id: string, components: Record<string, unknown> = {}) {
  return { id, version: id, components };
}

describe("EntityManager", () => {
  test("from builds a manager from an array", () => {
    const a = makeEntity("a");
    const b = makeEntity("b");
    const manager = EntityManager.from([a, b]);

    expect(manager.toArray()).toHaveLength(2);
    expect(manager.get("a")).toBe(a);
    expect(manager.get("b")).toBe(b);
  });

  test("get returns undefined for missing entity", () => {
    const manager = EntityManager.from([]);
    expect(manager.get("ghost")).toBeUndefined();
  });

  test("insert adds a new entity", () => {
    const manager = EntityManager.from([]);
    const entity = makeEntity("a", { position: { x: 1, y: 2 } });

    manager.insert(entity);

    expect(manager.get("a")).toBe(entity);
  });

  test("insert overwrites existing entity with same id", () => {
    const manager = EntityManager.from([]);
    const first = makeEntity("a", { x: 1 });
    const second = makeEntity("a", { x: 2 });

    manager.insert(first);
    manager.insert(second);

    expect(manager.get("a")).toBe(second);
    expect(manager.toArray()).toHaveLength(1);
  });

  test("remove deletes an entity", () => {
    const manager = EntityManager.from([makeEntity("a"), makeEntity("b")]);

    manager.remove("a");

    expect(manager.get("a")).toBeUndefined();
    expect(manager.get("b")).toBeDefined();
  });

  test("remove is a no-op for missing entity", () => {
    const manager = EntityManager.from([makeEntity("a")]);
    manager.remove("ghost");
    expect(manager.toArray()).toHaveLength(1);
  });

  test("entitiesWithComponent filters by component key", () => {
    const manager = EntityManager.from([
      makeEntity("a", { position: { x: 0, y: 0 } }),
      makeEntity("b", { velocity: { dx: 1, dy: 1 } }),
      makeEntity("c", { position: { x: 2, y: 2 }, velocity: { dx: 3, dy: 3 } }),
    ]);

    const withPos = manager.entitiesWithComponent(Position);
    expect(withPos).toHaveLength(2);
    expect(withPos.map((e) => e.id)).toContain("a");
    expect(withPos.map((e) => e.id)).toContain("c");

    const withVel = manager.entitiesWithComponent(Velocity);
    expect(withVel).toHaveLength(2);
    expect(withVel.map((e) => e.id)).toContain("b");
    expect(withVel.map((e) => e.id)).toContain("c");
  });

  test("entitiesWithComponent returns empty array when none match", () => {
    const manager = EntityManager.from([makeEntity("a")]);
    expect(manager.entitiesWithComponent(Position)).toEqual([]);
  });

  test("getComponent returns typed component data", () => {
    const manager = EntityManager.from([]);
    const entity = makeEntity("a", { position: { x: 10, y: 20 } });

    const pos = manager.getComponent(entity, Position);

    expect(pos).toEqual({ x: 10, y: 20 });
  });

  test("getComponent returns undefined when component is missing", () => {
    const manager = EntityManager.from([]);
    const entity = makeEntity("a", { velocity: { dx: 1, dy: 1 } });

    const pos = manager.getComponent(entity, Position);

    expect(pos).toBeUndefined();
  });

  test("toArray returns all entities", () => {
    const a = makeEntity("a");
    const b = makeEntity("b");
    const manager = EntityManager.from([a, b]);

    const arr = manager.toArray();

    expect(arr).toHaveLength(2);
    expect(arr).toContain(a);
    expect(arr).toContain(b);
  });
});
