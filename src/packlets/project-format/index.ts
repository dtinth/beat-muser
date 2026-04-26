/**
 * @packageDocumentation
 *
 * TypeBox schemas, TypeScript types, and parser for the
 * `beat-muser-project.json` file format. Defines the ECS-lite entity model,
 * core components, and project metadata structure.
 */

export { ProjectMetadataSchema, ProjectFileSchema } from "./schema";

export type { ProjectMetadata, ProjectFile } from "./types";

export { parseProjectFile } from "./parser";
