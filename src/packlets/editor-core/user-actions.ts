/**
 * @packageDocumentation
 *
 * User action classes for undoable editor operations.
 */

import type { WritableAtom } from "nanostores";
import { uuidv7 } from "uuidv7";
import type { Entity } from "../entity-manager";
import { LEVEL_REF } from "./components";
import type { EditorContext } from "./editor-context";
import { ProjectSlice } from "./slices/project-slice";
import { SelectionSlice } from "./slices/selection-slice";
import { LevelSlice } from "./slices/level-slice";
import { ChartSlice } from "./slices/chart-slice";
import type { UserAction } from "./types";

export class DeleteUserAction implements UserAction {
  title = "Delete selection";
  private ctx: EditorContext;
  private entityIds: string[];
  private entities: Entity[];

  constructor(ctx: EditorContext, entityIds: string[], entities: Entity[]) {
    this.ctx = ctx;
    this.entityIds = entityIds;
    this.entities = entities;
  }

  do(): void {
    const em = this.ctx.get(ProjectSlice).entityManager;
    for (const id of this.entityIds) {
      em.delete(id);
    }
    this.ctx.get(SelectionSlice).$selection.set(new Set());
  }

  undo(): void {
    const em = this.ctx.get(ProjectSlice).entityManager;
    for (const entity of this.entities) {
      em.restore(entity);
    }
    const chartId = this.ctx.get(ChartSlice).$selectedChartId.get();
    const visibleLevels = new Set(
      (chartId ? this.ctx.get(LevelSlice).getVisibleLevels(chartId) : []).map((l) => l.id),
    );
    const selection = new Set<string>();
    for (const entity of this.entities) {
      const levelRef = em.getComponent(entity, LEVEL_REF);
      if (levelRef && !visibleLevels.has(levelRef.levelId)) continue;
      selection.add(entity.id);
    }
    this.ctx.get(SelectionSlice).$selection.set(selection);
  }
}

export class EraseUserAction implements UserAction {
  title = "Erase entity";
  private ctx: EditorContext;
  private entityId: string;
  private entitySnapshot: Entity;

  constructor(ctx: EditorContext, entityId: string, entitySnapshot: Entity) {
    this.ctx = ctx;
    this.entityId = entityId;
    this.entitySnapshot = entitySnapshot;
  }

  do(): void {
    this.ctx.get(ProjectSlice).entityManager.delete(this.entityId);
    this.ctx.get(SelectionSlice).$selection.set(new Set());
  }

  undo(): void {
    this.ctx.get(ProjectSlice).entityManager.restore(this.entitySnapshot);
  }
}

export class PlaceEntityUserAction implements UserAction {
  title = "Place entity";
  private ctx: EditorContext;
  private entity: Entity;
  private columnId: string;
  private previousSelection: Set<string>;
  private lastPlacedAtom: WritableAtom<{ entityId: string; columnId: string } | null>;

  constructor(
    ctx: EditorContext,
    entity: Entity,
    columnId: string,
    previousSelection: Set<string>,
    lastPlacedAtom: WritableAtom<{ entityId: string; columnId: string } | null>,
  ) {
    this.ctx = ctx;
    this.entity = entity;
    this.columnId = columnId;
    this.previousSelection = previousSelection;
    this.lastPlacedAtom = lastPlacedAtom;
  }

  do(): void {
    this.ctx.get(ProjectSlice).entityManager.insert(this.entity);
    this.ctx.get(SelectionSlice).$selection.set(new Set([this.entity.id]));
    this.lastPlacedAtom.set({
      entityId: this.entity.id,
      columnId: this.columnId,
    });
  }

  undo(): void {
    this.ctx.get(ProjectSlice).entityManager.delete(this.entity.id);
    this.ctx.get(SelectionSlice).$selection.set(new Set(this.previousSelection));
    this.lastPlacedAtom.set(null);
  }
}

export class EditEntityUserAction implements UserAction {
  title = "Edit entity";
  private ctx: EditorContext;
  private entityId: string;
  private oldComponents: Record<string, unknown>;
  private newComponents: Record<string, unknown>;

  constructor(
    ctx: EditorContext,
    entityId: string,
    oldComponents: Record<string, unknown>,
    newComponents: Record<string, unknown>,
  ) {
    this.ctx = ctx;
    this.entityId = entityId;
    this.oldComponents = oldComponents;
    this.newComponents = newComponents;
  }

  do(): void {
    const em = this.ctx.get(ProjectSlice).entityManager;
    const entity = em.get(this.entityId);
    if (!entity) return;
    em.insert({
      ...entity,
      components: structuredClone(this.newComponents),
      version: uuidv7(),
    });
  }

  undo(): void {
    const em = this.ctx.get(ProjectSlice).entityManager;
    const entity = em.get(this.entityId);
    if (!entity) return;
    em.insert({
      ...entity,
      components: structuredClone(this.oldComponents),
      version: uuidv7(),
    });
  }
}

export class BatchEditEntitiesUserAction implements UserAction {
  title = "Move events";
  private ctx: EditorContext;
  private edits: {
    entityId: string;
    oldComponents: Record<string, unknown>;
    newComponents: Record<string, unknown>;
  }[];

  constructor(
    ctx: EditorContext,
    edits: {
      entityId: string;
      oldComponents: Record<string, unknown>;
      newComponents: Record<string, unknown>;
    }[],
  ) {
    this.ctx = ctx;
    this.edits = edits;
  }

  do(): void {
    const em = this.ctx.get(ProjectSlice).entityManager;
    for (const { entityId, newComponents } of this.edits) {
      const entity = em.get(entityId);
      if (!entity) continue;
      em.insert({
        ...entity,
        components: structuredClone(newComponents),
        version: uuidv7(),
      });
    }
  }

  undo(): void {
    const em = this.ctx.get(ProjectSlice).entityManager;
    for (const { entityId, oldComponents } of this.edits) {
      const entity = em.get(entityId);
      if (!entity) continue;
      em.insert({
        ...entity,
        components: structuredClone(oldComponents),
        version: uuidv7(),
      });
    }
  }
}
