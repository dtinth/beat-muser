import type { Static } from "typebox";
import type { ProjectMetadataSchema, ProjectFileSchema } from "./schema.ts";

export type ProjectMetadata = Static<typeof ProjectMetadataSchema>;
export type ProjectFile = Static<typeof ProjectFileSchema>;
