/**
 * @packageDocumentation
 *
 * TypeBox schemas, TypeScript types, and parser for the
 * `beat-muser-project.json` file format. Defines the ECS-lite entity model,
 * core components, and project metadata structure.
 */

export { ProjectMetadataSchema, ProjectFileSchema } from "./schema.ts";

export type { ProjectMetadata, ProjectFile } from "./types.ts";

export { parseProjectFile } from "./parser.ts";
