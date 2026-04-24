import type { Static } from "typebox";
import type { ProjectMetadataSchema, ProjectFileSchema } from "./schema";

export type ProjectMetadata = Static<typeof ProjectMetadataSchema>;
export type ProjectFile = Static<typeof ProjectFileSchema>;
