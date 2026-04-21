import type { Static } from "typebox";
import type {
  ChartSchema,
  ChartMetadataSchema,
  EntitySchema,
  ProjectFileSchema,
  ProjectMetadataSchema,
} from "./schema";

export type Entity = Static<typeof EntitySchema>;
export type ChartMetadata = Static<typeof ChartMetadataSchema>;
export type Chart = Static<typeof ChartSchema>;
export type ProjectMetadata = Static<typeof ProjectMetadataSchema>;
export type ProjectFile = Static<typeof ProjectFileSchema>;
