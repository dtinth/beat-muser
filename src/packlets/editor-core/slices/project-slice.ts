import { EntityManager, EntityBuilder } from "../../entity-manager";
import { CHART } from "../components";
import { DEFAULT_CHART_SIZE } from "../types";
import { Slice } from "../slice";
import type { EditorContext } from "../editor-context";
import type { ProjectFile } from "../../project-format";

export class ProjectSlice extends Slice {
  static readonly sliceKey = "project";

  readonly entityManager: EntityManager;

  constructor(ctx: EditorContext, project: ProjectFile) {
    super(ctx);
    this.entityManager = EntityManager.from(project.entities);

    // Guarantee: at least one chart always exists
    const charts = this.entityManager.entitiesWithComponent(CHART);
    if (charts.length === 0) {
      this.entityManager.insert(
        new EntityBuilder().with(CHART, { name: "Main Chart", size: DEFAULT_CHART_SIZE }).build(),
      );
    }
  }
}
