import type { Static } from "typebox";
import type {
  ChartSchema,
  ChartMetadataSchema,
  DeletedChartSchema,
  DeletedEntitySchema,
  EntitySchema,
  ProjectFileSchema,
  ProjectMetadataSchema,
} from "./schema";

export type Entity = Static<typeof EntitySchema>;
export type DeletedEntity = Static<typeof DeletedEntitySchema>;
export type ChartMetadata = Static<typeof ChartMetadataSchema>;
export type Chart = Static<typeof ChartSchema>;
export type DeletedChart = Static<typeof DeletedChartSchema>;
export type ProjectMetadata = Static<typeof ProjectMetadataSchema>;
export type ProjectFile = Static<typeof ProjectFileSchema>;
