import { uuidv7 } from "uuidv7";
import type { Static, TSchema } from "typebox";
import { EntityComponentType } from "./index";
import type { Entity } from "./index";

export class EntityBuilder {
  private components: Record<string, unknown> = {};

  with<T extends TSchema>(component: EntityComponentType<T>, data: Static<T>): this {
    this.components[component.key] = data;
    return this;
  }

  build(): Entity {
    return {
      id: uuidv7(),
      version: uuidv7(),
      components: { ...this.components },
    };
  }
}

export function entity(callback: (e: EntityBuilder) => EntityBuilder | void): Entity {
  const builder = new EntityBuilder();
  callback(builder);
  return builder.build();
}
