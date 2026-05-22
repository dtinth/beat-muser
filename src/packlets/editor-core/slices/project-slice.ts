import { atom } from "nanostores";
import { EntityManager, EntityBuilder } from "../../entity-manager/index.ts";
import { CHART } from "../components.ts";
import { DEFAULT_CHART_SIZE } from "../types.ts";
import { Slice } from "../slice.ts";
import type { EditorContext } from "../editor-context.ts";
import type { ProjectFile, ProjectMetadata } from "../../project-format/index.ts";

export class ProjectSlice extends Slice {
  static readonly sliceKey = "project";

  readonly entityManager: EntityManager;
  $metadata = atom<ProjectMetadata>({ title: "", artist: "", genre: "" });

  constructor(ctx: EditorContext, project: ProjectFile) {
    super(ctx);
    this.entityManager = EntityManager.from(project.entities);
    this.$metadata.set(project.metadata);

    // Guarantee: at least one chart always exists
    const charts = this.entityManager.entitiesWithComponent(CHART);
    if (charts.length === 0) {
      this.entityManager.insert(
        new EntityBuilder().with(CHART, { name: "Main Chart", size: DEFAULT_CHART_SIZE }).build(),
      );
    }
  }
}
