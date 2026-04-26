/**
 * @packageDocumentation
 *
 * User action classes for undoable editor operations.
 */

import { uuidv7 } from "uuidv7";
import type { Entity } from "../entity-manager";
import { LEVEL_REF } from "./components";
import type { EditorController } from "./index";
import type { UserAction } from "./types";

export class DeleteUserAction implements UserAction {
  title = "Delete selection";
  private controller: EditorController;
  private entityIds: string[];
  private entities: Entity[];

  constructor(controller: EditorController, entityIds: string[], entities: Entity[]) {
    this.controller = controller;
    this.entityIds = entityIds;
    this.entities = entities;
  }

  do(): void {
    const em = this.controller.getEntityManager();
    for (const id of this.entityIds) {
      em.delete(id);
    }
    this.controller.$selection.set(new Set());
    this.controller.updateVisibleRenderObjects();
  }

  undo(): void {
    const em = this.controller.getEntityManager();
    for (const entity of this.entities) {
      em.restore(entity);
    }
    const visibleLevels = new Set(this.controller.getVisibleLevels().map((l) => l.id));
    const selection = new Set<string>();
    for (const entity of this.entities) {
      const levelRef = em.getComponent(entity, LEVEL_REF);
      if (levelRef && !visibleLevels.has(levelRef.levelId)) continue;
      selection.add(entity.id);
    }
    this.controller.$selection.set(selection);
    this.controller.updateVisibleRenderObjects();
  }
}

export class EraseUserAction implements UserAction {
  title = "Erase entity";
  private controller: EditorController;
  private entityId: string;
  private entitySnapshot: Entity;

  constructor(controller: EditorController, entityId: string, entitySnapshot: Entity) {
    this.controller = controller;
    this.entityId = entityId;
    this.entitySnapshot = entitySnapshot;
  }

  do(): void {
    this.controller.getEntityManager().delete(this.entityId);
    this.controller.$selection.set(new Set());
    this.controller.updateVisibleRenderObjects();
  }

  undo(): void {
    this.controller.getEntityManager().restore(this.entitySnapshot);
    this.controller.updateVisibleRenderObjects();
  }
}

export class PlaceEntityUserAction implements UserAction {
  title = "Place entity";
  private controller: EditorController;
  private entity: Entity;
  private columnId: string;
  private previousSelection: Set<string>;

  constructor(
    controller: EditorController,
    entity: Entity,
    columnId: string,
    previousSelection: Set<string>,
  ) {
    this.controller = controller;
    this.entity = entity;
    this.columnId = columnId;
    this.previousSelection = previousSelection;
  }

  do(): void {
    this.controller.getEntityManager().insert(this.entity);
    this.controller.$selection.set(new Set([this.entity.id]));
    this.controller.$lastPlacedEntityInfo.set({
      entityId: this.entity.id,
      columnId: this.columnId,
    });
    this.controller.updateVisibleRenderObjects();
  }

  undo(): void {
    this.controller.getEntityManager().delete(this.entity.id);
    this.controller.$selection.set(new Set(this.previousSelection));
    this.controller.$lastPlacedEntityInfo.set(null);
    this.controller.updateVisibleRenderObjects();
  }
}

export class EditEntityUserAction implements UserAction {
  title = "Edit entity";
  private controller: EditorController;
  private entityId: string;
  private oldComponents: Record<string, unknown>;
  private newComponents: Record<string, unknown>;

  constructor(
    controller: EditorController,
    entityId: string,
    oldComponents: Record<string, unknown>,
    newComponents: Record<string, unknown>,
  ) {
    this.controller = controller;
    this.entityId = entityId;
    this.oldComponents = oldComponents;
    this.newComponents = newComponents;
  }

  do(): void {
    const em = this.controller.getEntityManager();
    const entity = em.get(this.entityId);
    if (!entity) return;
    em.insert({
      ...entity,
      components: structuredClone(this.newComponents),
      version: uuidv7(),
    });
    this.controller.updateVisibleRenderObjects();
  }

  undo(): void {
    const em = this.controller.getEntityManager();
    const entity = em.get(this.entityId);
    if (!entity) return;
    em.insert({
      ...entity,
      components: structuredClone(this.oldComponents),
      version: uuidv7(),
    });
    this.controller.updateVisibleRenderObjects();
  }
}
