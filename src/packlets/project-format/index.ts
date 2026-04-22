/**
 * @packageDocumentation
 *
 * TypeBox schemas, TypeScript types, and parser for the
 * `beat-muser-project.json` file format. Defines the ECS-lite entity model,
 * core components, and project metadata structure.
 */

export {
  EntitySchema,
  DeletedEntitySchema,
  EventComponentSchema,
  ChartComponentSchema,
  ChartRefComponentSchema,
  NoteComponentSchema,
  BpmChangeComponentSchema,
  SoundComponentSchema,
  SoundRefComponentSchema,
  ProjectMetadataSchema,
  ProjectFileSchema,
} from "./schema";

export type {
  Entity,
  DeletedEntity,
  EventComponent,
  ChartComponent,
  ChartRefComponent,
  NoteComponent,
  BpmChangeComponent,
  SoundComponent,
  SoundRefComponent,
  ProjectMetadata,
  ProjectFile,
} from "./types";

export { parseProjectFile } from "./parser";
