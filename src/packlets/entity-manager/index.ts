/**
 * @packageDocumentation
 *
 * Lightweight entity-component-system (ECS) manager. Provides type-safe
 * component access and entity queries without framework dependencies.
 *
 * ## Design
 *
 * - `Entity` — a plain object with `id`, `version`, and a `components` bag.
 * - `EntityComponentType<T>` — a typed handle for a component. Encodes the
 *   component type at compile time and stores the runtime string key.
 * - `EntityManager` — holds entities in a `Map<string, Entity>` and provides
 *   query methods. Mutable in place.
 *
 * ## Usage
 *
 * ```ts
 * const Position = new EntityComponentType<{ x: number; y: number }>("position");
 * const manager = EntityManager.from(entities);
 *
 * const withPos = manager.entitiesWithComponent(Position);
 * const pos = manager.getComponent(entity, Position); // { x, y } | undefined
 * ```
 */

import { Type, type Static, type TSchema } from "typebox";
import { uuidv7 } from "uuidv7";
import { atom } from "nanostores";

// ---------------------------------------------------------------------------
// Entity
// ---------------------------------------------------------------------------

export const EntitySchema = Type.Object(
  {
    id: Type.String({
      description: "UUIDv7 unique identifier, immutable once created.",
    }),
    version: Type.String({
      description: "UUIDv7 revision timestamp. Updated on every edit.",
    }),
    components: Type.Record(Type.String(), Type.Any(), {
      description:
        "ECS-style component bag. Keys are component names. Values are component-specific objects.",
    }),
  },
  {
    additionalProperties: false,
    description: "An entity is a uniquely identified object with a versioned bag of components.",
  },
);

export type Entity = Static<typeof EntitySchema>;

export { EntityBuilder, entity } from "./builder.ts";

// ---------------------------------------------------------------------------
// EntityComponentType
// ---------------------------------------------------------------------------

/**
 * A typed handle for an ECS component. Carries both the runtime string key
 * and the TypeScript type of the component data.
 */
export class EntityComponentType<T extends TSchema> {
  key: string;
  schema: T;

  constructor(key: string, schema: T) {
    this.key = key;
    this.schema = schema;
  }
}

// ---------------------------------------------------------------------------
// EntityManager
// ---------------------------------------------------------------------------

export class EntityManager {
  private entities = new Map<string, Entity>();
  private mutationVersion = 1;
  $mutationVersion = atom<number>(1);

  static from(array: Entity[]): EntityManager {
    const manager = new EntityManager();
    for (const entity of array) {
      manager.entities.set(entity.id, entity);
    }
    return manager;
  }

  toArray(): Entity[] {
    return Array.from(this.entities.values());
  }

  get(id: string): Entity | undefined {
    return this.entities.get(id);
  }

  insert(entity: Entity): void {
    this.entities.set(entity.id, entity);
    this.mutationVersion++;
    this.$mutationVersion.set(this.mutationVersion);
  }

  remove(id: string): void {
    this.entities.delete(id);
    this.mutationVersion++;
    this.$mutationVersion.set(this.mutationVersion);
  }

  /**
   * Deletes an entity by stripping all its components and bumping its version.
   * The entity remains in the manager but is invisible to component queries.
   */
  delete(id: string): void {
    const entity = this.entities.get(id);
    if (!entity) return;
    entity.components = {};
    entity.version = uuidv7();
    this.mutationVersion++;
    this.$mutationVersion.set(this.mutationVersion);
  }

  /**
   * Restores a previously deleted entity by re-inserting its full snapshot.
   */
  restore(entity: Entity): void {
    this.entities.set(entity.id, entity);
    this.mutationVersion++;
    this.$mutationVersion.set(this.mutationVersion);
  }

  getMutationVersion(): number {
    return this.mutationVersion;
  }

  /**
   * Returns all entities that carry the given component.
   */
  entitiesWithComponent<T extends TSchema>(component: EntityComponentType<T>): Entity[] {
    const result: Entity[] = [];
    for (const entity of this.entities.values()) {
      if (component.key in entity.components) {
        result.push(entity);
      }
    }
    return result;
  }

  /**
   * Returns the component data for an entity, or `undefined` if the entity
   * does not carry this component.
   */
  getComponent<T extends TSchema>(
    entity: Entity,
    component: EntityComponentType<T>,
  ): Static<T> | undefined {
    const value: unknown = entity.components[component.key];
    // The component bag is dynamically typed (`Type.Any()`), so the mapping from
    // a runtime key to its compile-time `Static<T>` cannot be witnessed by the
    // type system here; this generic cast is the ECS boundary and is unavoidable.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion, typescript/no-unsafe-return -- generic ECS component cast, see comment above
    return value as Static<T> | undefined;
  }
}
